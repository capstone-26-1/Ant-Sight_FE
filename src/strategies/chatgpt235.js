// =========================================================================
// strategies/chatgpt235.js — ChatGPT(235) 전략 종목별 신호 평가
//
// 원본 룰 (compare_llm_strategies.py:118-206):
//   진입(BUY): MA20>MA60 AND close>MA20 AND mom60 상위 20% AND vol20 하위 90%
//              AND 시장>MA60
//   청산(SELL): close<MA20 OR -8% 손절
//
// FE 단일종목 평가 단순화 (모달에 명시):
//   - "mom60 상위 20%" 는 cross-section ranking 필요 → 절대 임계값
//     (mom60 ≥ +5%) 으로 근사
//   - "vol20 하위 90%" 도 cross-section → 절대 상한 (vol20 ≤ 60%/년) 으로 근사
//   - 손절(-8%) 은 보유 포지션 평가용이라 신규 진입 시그널에선 제외
//
// 입력: 일봉 종가 배열 + 시장 스냅샷 (marketProxy.getMarketSnapshot())
// 출력: { signal, conditions[], summary }
// =========================================================================
import { sma, momentum, realizedVol, last } from './indicators';

const MOM60_THRESHOLD = 0.05;   // mom60 ≥ +5% 를 "상위 20%" 근사
const VOL20_THRESHOLD = 0.60;   // vol20 ≤ 60%/년 을 "하위 90%" 근사

/**
 * @param {{date: string, close: number}[]} dailyOhlc — fiveMinToDaily() 결과
 * @param {{ aboveMa60: boolean|null }} marketSnap — getMarketSnapshot()
 * @returns {{
 *   signal: 'BUY'|'HOLD',
 *   conditions: { id: string, label: string, value: string, threshold: string, passed: boolean|null }[],
 *   passedCount: number,
 *   totalCount: number,
 * }}
 */
export function evaluateChatGPT235(dailyOhlc, marketSnap) {
    const closes = dailyOhlc.map(d => d.close);

    const ma20 = last(sma(closes, 20));
    const ma60 = last(sma(closes, 60));
    const cur  = last(closes);
    const mom60Series = momentum(closes, 60);
    const mom60 = last(mom60Series);
    const vol20 = last(realizedVol(closes, 20));

    const conds = [
        {
            id: 'ma_trend',
            label: 'MA20 > MA60 (상승 추세)',
            value: ma20 != null && ma60 != null ? `${ma20.toFixed(0)} vs ${ma60.toFixed(0)}` : '데이터 부족',
            threshold: 'MA20 > MA60',
            passed: ma20 != null && ma60 != null ? ma20 > ma60 : null,
        },
        {
            id: 'price_above_ma20',
            label: '종가 > MA20',
            value: cur != null && ma20 != null ? `${cur.toFixed(0)} vs ${ma20.toFixed(0)}` : '데이터 부족',
            threshold: 'close > MA20',
            passed: cur != null && ma20 != null ? cur > ma20 : null,
        },
        {
            id: 'mom60',
            label: '60일 모멘텀 (상위 20% 근사)',
            value: mom60 != null ? `${(mom60 * 100).toFixed(1)}%` : '데이터 부족',
            threshold: `≥ +${(MOM60_THRESHOLD * 100).toFixed(0)}%`,
            passed: mom60 != null ? mom60 >= MOM60_THRESHOLD : null,
        },
        {
            id: 'vol20',
            label: '20일 변동성 (하위 90% 근사)',
            value: vol20 != null ? `${(vol20 * 100).toFixed(0)}%/년` : '데이터 부족',
            threshold: `≤ ${(VOL20_THRESHOLD * 100).toFixed(0)}%/년`,
            passed: vol20 != null ? vol20 <= VOL20_THRESHOLD : null,
        },
        {
            id: 'market_above_ma60',
            label: '시장 > MA60 (디리스킹 필터)',
            value: marketSnap?.aboveMa60 == null ? '데이터 부족' : marketSnap.aboveMa60 ? '통과' : '미통과',
            threshold: '시장지수 > 60일 MA',
            passed: marketSnap?.aboveMa60 ?? null,
        },
    ];

    const passed = conds.filter(c => c.passed === true).length;
    const total  = conds.length;
    const allPassed = conds.every(c => c.passed === true);
    return {
        signal: allPassed ? 'BUY' : 'HOLD',
        conditions: conds,
        passedCount: passed,
        totalCount: total,
    };
}
