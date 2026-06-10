import { api, normalizeKeys } from './client';

/**
 * @typedef {Object} QuoteResponse
 * @property {string} ticker
 * @property {number} currentPrice
 * @property {number} changeAmount  - 전일 대비(원). 음수면 하락.
 * @property {number} changeRate    - % 단위 (예: -0.42 → -0.42%)
 * @property {number} accVolume
 * @property {number} openPrice
 * @property {number} highPrice
 * @property {number} lowPrice
 * @property {string} fetchedAt     - ISO LocalDateTime (KST), 서버 캐시 적재 시각
 */

/**
 * @typedef {Object} CandleResponse
 * @property {string} ticker
 * @property {string} candleTime    - ISO LocalDateTime (KST)
 * @property {number} openPrice
 * @property {number} highPrice
 * @property {number} lowPrice
 * @property {number} closePrice
 * @property {number} volume
 */

export const stockApi = {
    search: (query, limit = 20) =>
        api.get(`/api/stocks/search?q=${encodeURIComponent(query)}&limit=${limit}`),

    findByTicker: (ticker) =>
        api.get(`/api/stocks/${ticker}`),

    getActive: () =>
        api.get('/api/stocks/active'),

    /**
     * 실시간 현재가 조회. 백엔드 캐시 10s TTL, 5s 폴링 안전.
     * @param {string} ticker
     * @returns {Promise<QuoteResponse>}
     */
    getQuote: (ticker) =>
        api.get(`/api/stocks/${ticker}/quote`).then(normalizeKeys),

    /**
     * 5분봉 캔들 (최신순, candleTime DESC). 차트 라이브러리에 넣을 때 reverse 필요할 수 있음.
     * @param {string} ticker
     * @param {number} [limit=100] 1~500
     * @returns {Promise<CandleResponse[]>}
     */
    getCandles: (ticker, limit = 100) =>
        api.get(`/api/stocks/${ticker}/candles?limit=${limit}`).then(normalizeKeys),
};
