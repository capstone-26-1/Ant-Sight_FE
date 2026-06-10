// =========================================================================
// strategies/metrics.js — LLM 전략 비교용 통계 helper
//
// 입력: 일별 수익률 시계열 (returns[] = [{date, B&H, 개미 디리스킹, ...}])
// 출력: 누적수익률 시계열 / 샤프 / MDD / 승률 / 거래수(=신호일수) 등
//
// 모든 계산은 클라이언트 측. 백테스트 엔진은 아니고, 이미 계산된
// 일별 수익률에 대한 단순 통계.
// =========================================================================

const TRADING_DAYS_PER_YEAR = 252;

// 일별 수익률 시리즈 → 누적수익률 시리즈 (마지막 = 총수익률).
//   (1 + r1)(1 + r2)...(1 + rn) - 1
export function toCumulative(dailyReturns) {
    const out = new Array(dailyReturns.length);
    let acc = 1;
    for (let i = 0; i < dailyReturns.length; i++) {
        const r = dailyReturns[i] ?? 0;
        acc *= (1 + r);
        out[i] = acc - 1;
    }
    return out;
}

// 연환산 샤프 비율 (무위험금리 0% 가정 — data_limits 참조).
//   sharpe = mean(daily) / std(daily) * sqrt(252)
export function sharpe(dailyReturns) {
    if (!dailyReturns.length) return 0;
    const n = dailyReturns.length;
    const mean = dailyReturns.reduce((s, r) => s + (r ?? 0), 0) / n;
    if (n < 2) return 0;
    const variance = dailyReturns.reduce((s, r) => {
        const d = (r ?? 0) - mean;
        return s + d * d;
    }, 0) / (n - 1);
    const std = Math.sqrt(variance);
    if (std === 0) return 0;
    return (mean / std) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

// Max DrawDown — 누적자산 시리즈 기준 최대 손실폭 (음수, 0 ~ -1).
//   각 시점에서 이전까지의 최고점 대비 현재 자산의 낙폭 → 가장 큰 낙폭.
export function maxDrawDown(dailyReturns) {
    if (!dailyReturns.length) return 0;
    let acc = 1;
    let peak = 1;
    let mdd = 0;
    for (const r of dailyReturns) {
        acc *= (1 + (r ?? 0));
        if (acc > peak) peak = acc;
        const dd = (acc - peak) / peak;
        if (dd < mdd) mdd = dd;
    }
    return mdd;
}

// 승률 — 수익률 != 0 인 일 중 양수 비중. 0 인 날은 거래 없음으로 간주해 제외.
export function winRate(dailyReturns) {
    const nonZero = dailyReturns.filter(r => r != null && r !== 0);
    if (!nonZero.length) return 0;
    const wins = nonZero.filter(r => r > 0).length;
    return wins / nonZero.length;
}

// 활동 일수 — 0 이 아닌 수익률이 기록된 날짜 수. 백테스트의 trade 수는
// 알 수 없으나 활동 일수는 전략이 얼마나 적극적으로 포지션을 잡았는지의
// 프록시로 표시.
export function activeDays(dailyReturns) {
    return dailyReturns.filter(r => r != null && r !== 0).length;
}

// 전체 전략 메트릭 한 번에 계산.
//   { cumulative: number[], totalReturn, sharpe, mdd, winRate, activeDays }
export function computeMetrics(dailyReturns) {
    const cumulative = toCumulative(dailyReturns);
    return {
        cumulative,
        totalReturn: cumulative.length ? cumulative[cumulative.length - 1] : 0,
        sharpe:    sharpe(dailyReturns),
        mdd:       maxDrawDown(dailyReturns),
        winRate:   winRate(dailyReturns),
        activeDays: activeDays(dailyReturns),
    };
}

// 기간 필터 — rows[] (각 행에 .date 포함) 중 lookback 기간만 추출.
//   period: '3M' | '6M' | '1Y' | 'ALL'
export function slicePeriod(rows, period) {
    if (!rows.length || period === 'ALL') return rows;
    const lastDate = new Date(rows[rows.length - 1].date);
    const monthsBack = period === '3M' ? 3 : period === '6M' ? 6 : 12;
    const cutoff = new Date(lastDate);
    cutoff.setMonth(cutoff.getMonth() - monthsBack);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return rows.filter(r => r.date >= cutoffStr);
}

// 표시용 포맷터
export const fmt = {
    pct:  (v, digits = 2) => v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(digits)}%`,
    pctRaw: (v, digits = 2) => v == null ? '—' : `${(v * 100).toFixed(digits)}%`,  // 부호 표시 없이
    num:  (v, digits = 2) => v == null ? '—' : v.toFixed(digits),
};
