import { api, normalizeKeys } from './client';

// 백엔드는 ISO_DATE_TIME(타임존 없음)을 받고 KST 로 해석한다.
// 사용자 브라우저 로컬TZ가 KST가 아닐 때 Date.getHours() 등은 어긋난 값을 주므로
// Intl + Asia/Seoul 로 변환해서 항상 KST 기준 문자열을 만든다.
function toIsoLocal(d) {
    if (typeof d === 'string') return d;
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    }).formatToParts(d);
    const get = (type) => parts.find(p => p.type === type)?.value ?? '00';
    const hh = get('hour') === '24' ? '00' : get('hour');  // Intl 가 24 를 줄 수 있음
    return `${get('year')}-${get('month')}-${get('day')}T${hh}:${get('minute')}:${get('second')}`;
}

/**
 * @typedef {Object} CandleWithAntPoint
 * BE 원본 필드: open/high/low/close/volume/ant_index/sentiment/candle_time
 * 차트(CandleChart, aggregateCandles)와의 호환을 위해 openPrice/highPrice/... 필드도 함께 노출.
 * @property {string} candleTime     - ISO LocalDateTime (KST)
 * @property {number} openPrice
 * @property {number} highPrice
 * @property {number} lowPrice
 * @property {number} closePrice
 * @property {number} volume
 * @property {number|null} antIndex  - 같은 15분 버킷 점수. 매칭 없으면 null.
 * @property {('POSITIVE'|'NEUTRAL'|'NEGATIVE'|null)} sentiment
 */

/**
 * @typedef {Object} CandlesWithAnt
 * @property {string} ticker
 * @property {boolean} withAntIndex
 * @property {CandleWithAntPoint[]} points - candleTime DESC (최신 먼저)
 */

// BE 원본 캔들 포인트 → 차트 호환 포인트(필드명 매핑) 변환.
function mapPoint(ticker, p) {
    return {
        ticker,
        candleTime: p.candleTime,
        // 신/구 필드명 모두 노출 — 기존 차트 컴포넌트와 새 코드 모두 호환.
        open: p.open,
        high: p.high,
        low: p.low,
        close: p.close,
        openPrice:  p.open,
        highPrice:  p.high,
        lowPrice:   p.low,
        closePrice: p.close,
        volume:     p.volume,
        antIndex:   p.antIndex ?? null,
        sentiment:  p.sentiment ?? null,
    };
}

// BE 는 단일 요청 당 최대 7일 조회만 허용. 경계값에서 종종 실패하므로
// 안전 마진으로 6일 단위 청크 사용.
const CHUNK_DAYS    = 6;
const CHUNK_MS      = CHUNK_DAYS * 24 * 60 * 60 * 1000;

export const candlesApi = {
    /**
     * 캔들 + 개미지수 합본 (LEFT JOIN). 차트용 핵심 엔드포인트.
     * 응답 points는 candleTime DESC 정렬로 정규화된다 (CandleChart/aggregateCandles 호환).
     *
     * @param {string} ticker
     * @param {{from: Date|string, to?: Date|string, withAntIndex?: boolean}} opts
     * @returns {Promise<CandlesWithAnt>}
     */
    getCandles: (ticker, { from, to, withAntIndex = true } = {}) => {
        if (!from) throw new Error('candlesApi.getCandles: "from"은 필수입니다.');
        const params = new URLSearchParams();
        params.set('from', toIsoLocal(from));
        if (to) params.set('to', toIsoLocal(to));
        params.set('withAntIndex', String(withAntIndex));
        return api.get(`/api/candles/${ticker}?${params.toString()}`)
            .then(normalizeKeys)
            .then(resp => {
                const points = (resp.points || [])
                    .map(p => mapPoint(resp.ticker, p))
                    // BE 응답 정렬 순서가 변할 가능성에 대비해 명시적으로 DESC 정렬.
                    .sort((a, b) => (a.candleTime < b.candleTime ? 1 : -1));
                return {
                    ticker: resp.ticker,
                    withAntIndex: resp.withAntIndex,
                    points,
                };
            });
    },

    /**
     * BE 7일 한도를 우회하기 위해 [from, to] 구간을 6일 청크로 쪼개 병렬 fetch.
     * 결과는 candleTime 기준 중복 제거 + DESC 정렬.
     * 개별 청크 실패는 무시 (전체 실패는 아님 — 부분 데이터로 계속).
     *
     * @param {string} ticker
     * @param {{from: Date, to?: Date, withAntIndex?: boolean}} opts
     * @returns {Promise<CandlesWithAnt>}
     */
    getCandlesChunked: async (ticker, { from, to, withAntIndex = false } = {}) => {
        if (!from) throw new Error('candlesApi.getCandlesChunked: "from"은 필수입니다.');
        const fromMs = from.getTime();
        const toMs   = (to ?? new Date()).getTime();
        if (fromMs >= toMs) return { ticker, withAntIndex, points: [] };

        // 청크 경계 생성
        const ranges = [];
        let cursor = fromMs;
        while (cursor < toMs) {
            const chunkEnd = Math.min(cursor + CHUNK_MS, toMs);
            ranges.push({ from: new Date(cursor), to: new Date(chunkEnd) });
            cursor = chunkEnd;
        }

        const responses = await Promise.all(
            ranges.map(r =>
                candlesApi.getCandles(ticker, { from: r.from, to: r.to, withAntIndex })
                    .catch(() => null)  // 개별 청크 실패 무시
            )
        );

        // 중복 제거 (청크 경계가 동일 candleTime 을 양쪽에 포함할 가능성)
        const dedup = new Map();
        for (const resp of responses) {
            if (!resp?.points) continue;
            for (const p of resp.points) dedup.set(p.candleTime, p);
        }
        const points = [...dedup.values()].sort((a, b) => (a.candleTime < b.candleTime ? 1 : -1));
        return { ticker, withAntIndex, points };
    },
};
