// =========================================================================
// strategies/marketProxy.js — 시장 단위 지표 (B&H 누적 시리즈 기반)
//
// 입력 소스: src/data/llm_strategy_returns.json 의 "B&H" 컬럼.
//   = 시장 235종목 동일가중 일별 수익률.
//   → 누적해서 시장 자산 시리즈로 사용 (VKOSPI/MA/momentum 산출).
//
// 모든 시장 지표는 ticker 비종속 — 페이지 로드 시 1회 계산해 캐시.
// Claude/Gemini 같은 "시장 비중 룰" 전략의 현재 의견 산출에 사용.
// =========================================================================
import LLM_RETURNS from '../data/llm_strategy_returns.json';
import { sma, momentum, realizedVol, last } from './indicators';

// B&H 일별 수익률 → 누적 자산(1 시작)
function buildMarketSeries() {
    const dates  = [];
    const closes = [];
    let acc = 1;
    for (const row of LLM_RETURNS) {
        const r = Number(row['B&H'] ?? 0);
        acc *= (1 + r);
        dates.push(row.date);
        closes.push(acc);
    }
    return { dates, closes };
}

// 모듈 로드 시 1회 계산. ticker 비종속이라 호출마다 다시 만들 필요 없음.
const MARKET = buildMarketSeries();
const MARKET_MA60 = sma(MARKET.closes, 60);
const MARKET_MOM252 = momentum(MARKET.closes, 252);  // 절대모멘텀 (12개월)
const MARKET_VKOSPI_PROXY = realizedVol(MARKET.closes, 20);  // VKOSPI 프록시 = 20일 연환산 RV

/**
 * 시장 현재 스냅샷.
 * @returns {{
 *   asOf: string,         // 마지막 데이터 날짜
 *   close: number,        // 시장 자산 수준
 *   ma60: number|null,    // 60일 단순이동평균
 *   aboveMa60: boolean,   // close > ma60
 *   mom12m: number|null,  // 12개월 절대 모멘텀 (수익률)
 *   vkospiProxy: number|null,  // 20일 연환산 RV (소수 — 0.20 = 20%)
 * }}
 */
export function getMarketSnapshot() {
    const last_close = last(MARKET.closes);
    const ma60 = last(MARKET_MA60);
    return {
        asOf:     MARKET.dates[MARKET.dates.length - 1] ?? null,
        close:    last_close,
        ma60,
        aboveMa60: last_close != null && ma60 != null ? last_close > ma60 : null,
        mom12m:    last(MARKET_MOM252),
        vkospiProxy: last(MARKET_VKOSPI_PROXY),
    };
}

/**
 * Claude (축약) 현재 시장 의견.
 *   - VKOSPI throttle: <20% → 100%, 20~30% → 50%, >30% → 0%
 *   - 절대모멘텀: 12개월 수익률 < 0 → 0% 강제 (CD91=0% 가정)
 *   - 둘 중 더 보수적인 값 채택.
 *
 * @returns {{ allocation: number, reason: string, vkospi: number|null, mom12m: number|null }}
 */
export function getClaudeMarketOpinion() {
    const snap = getMarketSnapshot();
    const v = snap.vkospiProxy;
    const m = snap.mom12m;

    let vkospiBased = 1.0;
    let vkospiNote  = '데이터 부족';
    if (v != null) {
        if (v < 0.20)      { vkospiBased = 1.0; vkospiNote = `VKOSPI<20% → 100%`; }
        else if (v < 0.30) { vkospiBased = 0.5; vkospiNote = `VKOSPI 20~30% → 50%`; }
        else               { vkospiBased = 0.0; vkospiNote = `VKOSPI>30% → 0%`; }
    }

    let absMomBased = 1.0;
    let momNote = '데이터 부족';
    if (m != null) {
        if (m < 0) { absMomBased = 0; momNote = `12개월 시장 -${(Math.abs(m) * 100).toFixed(1)}% → 절대모멘텀 0%`; }
        else       { momNote = `12개월 시장 +${(m * 100).toFixed(1)}% → 절대모멘텀 통과`; }
    }

    const allocation = Math.min(vkospiBased, absMomBased);
    return {
        allocation,
        reason: `${vkospiNote} · ${momNote}`,
        vkospi: v,
        mom12m: m,
    };
}

/**
 * Gemini 현재 시장 의견.
 *   - 주봉 일목구름 간소화: 일봉 close가 9/26/52일 평균 모두 위면 진입 가능
 *   - VKOSPI throttle: <25% → 통과, ≥25% → 진입 보류
 *   - 둘 다 통과 → 'ENTRY', 아니면 'CASH'
 *
 * @returns {{ position: 'ENTRY'|'CASH', reason: string, vkospi: number|null, aboveCloud: boolean|null }}
 */
export function getGeminiMarketOpinion() {
    const closes = MARKET.closes;
    const cur = last(closes);
    const ma9  = last(sma(closes, 9));
    const ma26 = last(sma(closes, 26));
    const ma52 = last(sma(closes, 52));
    const v = last(MARKET_VKOSPI_PROXY);

    let aboveCloud = null;
    if (cur != null && ma9 != null && ma26 != null && ma52 != null) {
        aboveCloud = cur > ma9 && cur > ma26 && cur > ma52;
    }

    const vkospiOK = v != null ? v < 0.25 : null;

    if (aboveCloud === true && vkospiOK === true) {
        return {
            position: 'ENTRY',
            reason: `구름 위 진입 + VKOSPI<25%`,
            vkospi: v,
            aboveCloud,
        };
    }
    const reasons = [];
    if (aboveCloud === false) reasons.push('구름 아래');
    if (vkospiOK === false)   reasons.push(`VKOSPI ${(v * 100).toFixed(1)}% ≥ 25%`);
    return {
        position: 'CASH',
        reason: reasons.length ? reasons.join(' · ') : '데이터 부족',
        vkospi: v,
        aboveCloud,
    };
}
