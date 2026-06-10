// =========================================================================
// strategies/indicators.js — 기술적 지표 + 5분봉 → 일봉 집계
//
// 입력은 보통 종가 배열(close[]) 또는 OHLC 배열({close,high,low,open,date}).
// 모든 함수는 길이가 부족하면 마지막 원소 자리에 null/NaN을 채워 반환.
// =========================================================================

const TRADING_DAYS_PER_YEAR = 252;

// 5분봉(candleTime DESC) → 일봉(date ASC)
// 일봉 OHLC: open=하루 첫 캔들, close=마지막, high=max, low=min, volume=합산
export function fiveMinToDaily(candlesDesc) {
    if (!Array.isArray(candlesDesc) || candlesDesc.length === 0) return [];
    const asc = [...candlesDesc].reverse();  // 시간 ASC
    const byDate = new Map();
    for (const c of asc) {
        const date = (c.candleTime ?? '').slice(0, 10);
        if (!date) continue;
        const e = byDate.get(date);
        if (!e) {
            byDate.set(date, {
                date,
                open:  c.openPrice  ?? c.open,
                high:  c.highPrice  ?? c.high,
                low:   c.lowPrice   ?? c.low,
                close: c.closePrice ?? c.close,
                volume: c.volume ?? 0,
            });
        } else {
            e.high   = Math.max(e.high, c.highPrice  ?? c.high);
            e.low    = Math.min(e.low,  c.lowPrice   ?? c.low);
            e.close  = c.closePrice ?? c.close;  // ASC 마지막이 최신
            e.volume += (c.volume ?? 0);
        }
    }
    return Array.from(byDate.values());
}

// 단순 이동평균. 길이 < n 이면 모두 null.
export function sma(values, n) {
    const out = new Array(values.length).fill(null);
    if (values.length < n) return out;
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
        sum += values[i];
        if (i >= n) sum -= values[i - n];
        if (i >= n - 1) out[i] = sum / n;
    }
    return out;
}

// 모멘텀: (현재 / n일 전) - 1. n일 미만이면 null.
export function momentum(values, n) {
    const out = new Array(values.length).fill(null);
    for (let i = n; i < values.length; i++) {
        const prev = values[i - n];
        if (prev > 0) out[i] = values[i] / prev - 1;
    }
    return out;
}

// 일별 수익률.
export function dailyReturns(values) {
    const out = new Array(values.length).fill(null);
    for (let i = 1; i < values.length; i++) {
        if (values[i - 1] > 0) out[i] = values[i] / values[i - 1] - 1;
    }
    return out;
}

// 연환산 변동성 — 최근 n일 수익률 std × sqrt(252).
export function realizedVol(values, n = 20) {
    const rets = dailyReturns(values);
    const out  = new Array(values.length).fill(null);
    for (let i = n; i < values.length; i++) {
        const window = rets.slice(i - n + 1, i + 1).filter(r => r != null);
        if (window.length < 2) continue;
        const mean = window.reduce((s, r) => s + r, 0) / window.length;
        const variance = window.reduce((s, r) => s + (r - mean) * (r - mean), 0) / (window.length - 1);
        out[i] = Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR);
    }
    return out;
}

// RSI (Wilder smoothing). 표준 14일.
export function rsi(values, n = 14) {
    const out = new Array(values.length).fill(null);
    if (values.length <= n) return out;
    let avgGain = 0, avgLoss = 0;
    for (let i = 1; i <= n; i++) {
        const change = values[i] - values[i - 1];
        if (change >= 0) avgGain += change; else avgLoss -= change;
    }
    avgGain /= n; avgLoss /= n;
    out[n] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    for (let i = n + 1; i < values.length; i++) {
        const change = values[i] - values[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;
        avgGain = (avgGain * (n - 1) + gain) / n;
        avgLoss = (avgLoss * (n - 1) + loss) / n;
        out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
    return out;
}

// 가장 마지막 유효 값 반환.
export function last(arr) {
    for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i] != null && !Number.isNaN(arr[i])) return arr[i];
    }
    return null;
}
