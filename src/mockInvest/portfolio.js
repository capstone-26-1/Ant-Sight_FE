// =========================================================================
// mockInvest/portfolio.js — 모의투자 포트폴리오 코어 로직
//
// 정책:
//   - 초기 시드: 10,000,000원
//   - 수수료: 0.015% (매수·매도 양쪽)
//   - 거래세: 0.20% (매도만)
//   - 시장가 주문만 지원. 호가/지정가/조건부 X.
//   - 로컬 저장 (사용자별 분리). 서버 동기화 X.
//   - 장마감 후에도 주문 허용 — 마지막 quote 가격 사용 ("장마감가 기준" 라벨 UI 측 표시)
//
// 모든 거래 함수는 순수 함수: (portfolio, args) → { ok, portfolio, txn?, error? }
// localStorage I/O 는 load/save 만 담당.
// =========================================================================

export const INITIAL_SEED   = 10_000_000;
export const FEE_RATE       = 0.00015;  // 0.015% — 매수·매도 양쪽
export const TAX_RATE_SELL  = 0.0020;   // 0.20%  — 매도만

const LS_KEY_PREFIX = 'antsight_portfolio_';

/**
 * @typedef {Object} Holding
 * @property {string} ticker
 * @property {string} name
 * @property {number} quantity
 * @property {number} totalCost   - 매수 누적 (수수료 포함) — avgBuyPrice = totalCost / quantity
 * @property {string} firstBoughtAt   - ISO timestamp
 */

/**
 * @typedef {Object} Transaction
 * @property {string} id
 * @property {string} ticker
 * @property {string} name
 * @property {'BUY'|'SELL'} type
 * @property {number} quantity
 * @property {number} price       - 체결가 (시장가)
 * @property {number} gross       - price × quantity
 * @property {number} fee
 * @property {number} tax         - 매도만 양수, 매수는 0
 * @property {number} cashDelta   - 거래 후 현금 변화량 (매수 음수, 매도 양수)
 * @property {number|null} realizedPL  - 매도 시 실현손익, 매수는 null
 * @property {string} executedAt  - ISO timestamp
 * @property {boolean} afterHours - 장마감 후 체결 여부
 */

/**
 * @typedef {Object} Portfolio
 * @property {number} cash
 * @property {Object<string, Holding>} holdings   - { [ticker]: Holding }
 * @property {Transaction[]} history              - 최신 순
 */

// ── 빈 포트폴리오 생성 ─────────────────────────────────────────────────
export function emptyPortfolio() {
    return { cash: INITIAL_SEED, holdings: {}, history: [] };
}

// ── localStorage 키 ────────────────────────────────────────────────────
// 게스트는 'guest', 로그인 사용자는 userId. authUser 가 null 인 경우 호출 금지.
function keyOf(authUser) {
    if (!authUser) return null;
    if (authUser.type === 'guest') return LS_KEY_PREFIX + 'guest';
    if (authUser.userId != null)   return LS_KEY_PREFIX + String(authUser.userId);
    // username fallback (userId 미할당 케이스)
    if (authUser.username)         return LS_KEY_PREFIX + 'u_' + authUser.username;
    return null;
}

// ── load / save ────────────────────────────────────────────────────────
export function loadPortfolio(authUser) {
    const key = keyOf(authUser);
    if (!key) return emptyPortfolio();
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return emptyPortfolio();
        const parsed = JSON.parse(raw);
        // 최소 형태 검증 — 손상되었으면 새로 시작
        if (typeof parsed?.cash !== 'number' || !parsed?.holdings || !Array.isArray(parsed?.history)) {
            return emptyPortfolio();
        }
        return parsed;
    } catch {
        return emptyPortfolio();
    }
}

export function savePortfolio(authUser, portfolio) {
    const key = keyOf(authUser);
    if (!key) return;
    try {
        localStorage.setItem(key, JSON.stringify(portfolio));
    } catch { /* quota 초과 등은 무시 */ }
}

export function resetPortfolio(authUser) {
    const key = keyOf(authUser);
    if (!key) return emptyPortfolio();
    try { localStorage.removeItem(key); } catch { /* 무시 */ }
    return emptyPortfolio();
}

// ── 거래 실행 (순수 함수) ──────────────────────────────────────────────

function newTxnId() {
    return `txn_${Date.now()}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/**
 * 시장가 매수 — 수수료 포함 총비용 = price × qty × (1 + FEE_RATE)
 * @returns {{ ok: boolean, portfolio?: Portfolio, txn?: Transaction, error?: string }}
 */
export function executeBuy(portfolio, { ticker, name, quantity, price, afterHours = false }) {
    if (!ticker || !Number.isFinite(quantity) || quantity <= 0) {
        return { ok: false, error: '수량을 올바르게 입력하세요.' };
    }
    if (!Number.isFinite(price) || price <= 0) {
        return { ok: false, error: '시장가 정보를 받아오지 못했습니다. 잠시 후 다시 시도해주세요.' };
    }

    const gross = price * quantity;
    const fee   = gross * FEE_RATE;
    const totalDebit = gross + fee;

    if (portfolio.cash < totalDebit) {
        const shortage = totalDebit - portfolio.cash;
        return { ok: false, error: `잔고 부족 — ${Math.ceil(shortage).toLocaleString()}원 모자랍니다.` };
    }

    const prevHolding = portfolio.holdings[ticker];
    const newHolding = prevHolding
        ? {
            ...prevHolding,
            quantity:  prevHolding.quantity + quantity,
            totalCost: prevHolding.totalCost + totalDebit,
        }
        : {
            ticker,
            name: name ?? ticker,
            quantity,
            totalCost: totalDebit,
            firstBoughtAt: new Date().toISOString(),
        };

    const txn = {
        id: newTxnId(),
        ticker,
        name: name ?? prevHolding?.name ?? ticker,
        type: 'BUY',
        quantity,
        price,
        gross,
        fee,
        tax: 0,
        cashDelta: -totalDebit,
        realizedPL: null,
        executedAt: new Date().toISOString(),
        afterHours,
    };

    const newPortfolio = {
        cash: portfolio.cash - totalDebit,
        holdings: { ...portfolio.holdings, [ticker]: newHolding },
        history: [txn, ...portfolio.history],
    };
    return { ok: true, portfolio: newPortfolio, txn };
}

/**
 * 시장가 매도 — 순수령액 = price × qty × (1 - FEE_RATE - TAX_RATE_SELL).
 * 실현손익 = 순수령액 - (avgBuyPrice × 매도수량).
 */
export function executeSell(portfolio, { ticker, quantity, price, afterHours = false }) {
    if (!ticker || !Number.isFinite(quantity) || quantity <= 0) {
        return { ok: false, error: '수량을 올바르게 입력하세요.' };
    }
    if (!Number.isFinite(price) || price <= 0) {
        return { ok: false, error: '시장가 정보를 받아오지 못했습니다. 잠시 후 다시 시도해주세요.' };
    }
    const holding = portfolio.holdings[ticker];
    if (!holding || holding.quantity <= 0) {
        return { ok: false, error: '보유 종목이 아닙니다.' };
    }
    if (quantity > holding.quantity) {
        return { ok: false, error: `보유 수량(${holding.quantity}주) 보다 많이 매도할 수 없습니다.` };
    }

    const gross = price * quantity;
    const fee   = gross * FEE_RATE;
    const tax   = gross * TAX_RATE_SELL;
    const totalCredit = gross - fee - tax;

    const avgBuyPrice = holding.totalCost / holding.quantity;
    const costRemoved = avgBuyPrice * quantity;
    const realizedPL  = totalCredit - costRemoved;

    const newQuantity  = holding.quantity - quantity;
    const newTotalCost = holding.totalCost - costRemoved;
    const newHoldings  = { ...portfolio.holdings };
    if (newQuantity <= 0) {
        delete newHoldings[ticker];
    } else {
        newHoldings[ticker] = { ...holding, quantity: newQuantity, totalCost: newTotalCost };
    }

    const txn = {
        id: newTxnId(),
        ticker,
        name: holding.name,
        type: 'SELL',
        quantity,
        price,
        gross,
        fee,
        tax,
        cashDelta: totalCredit,
        realizedPL,
        executedAt: new Date().toISOString(),
        afterHours,
    };

    const newPortfolio = {
        cash: portfolio.cash + totalCredit,
        holdings: newHoldings,
        history: [txn, ...portfolio.history],
    };
    return { ok: true, portfolio: newPortfolio, txn };
}

// ── 표시용 유틸 ────────────────────────────────────────────────────────

// 평가액 = Σ(현재가 × 수량). currentPrices = { ticker: number }
export function computeHoldingsValue(portfolio, currentPrices) {
    let sum = 0;
    for (const [ticker, h] of Object.entries(portfolio.holdings)) {
        const p = currentPrices[ticker];
        if (Number.isFinite(p)) sum += p * h.quantity;
    }
    return sum;
}

// 미실현 손익 = 평가액 - 보유 totalCost
export function computeUnrealizedPL(portfolio, currentPrices) {
    let pl = 0;
    let cost = 0;
    for (const [ticker, h] of Object.entries(portfolio.holdings)) {
        const p = currentPrices[ticker];
        if (Number.isFinite(p)) {
            pl   += (p * h.quantity) - h.totalCost;
            cost += h.totalCost;
        }
    }
    return { unrealizedPL: pl, costBasis: cost };
}

// 실현 손익 = 매도 거래의 realizedPL 합
export function computeRealizedPL(portfolio) {
    return portfolio.history.reduce((s, t) => s + (t.realizedPL ?? 0), 0);
}
