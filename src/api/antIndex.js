import { api, normalizeKeys } from './client';

// 백엔드는 ISO_DATE_TIME(타임존 없음)을 받고 KST 로 해석한다.
// 사용자 브라우저 로컬TZ 무관하게 항상 KST 기준 문자열 생성.
function toIsoLocal(d) {
    if (typeof d === 'string') return d;
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    }).formatToParts(d);
    const get = (type) => parts.find(p => p.type === type)?.value ?? '00';
    const hh = get('hour') === '24' ? '00' : get('hour');
    return `${get('year')}-${get('month')}-${get('day')}T${hh}:${get('minute')}:${get('second')}`;
}

/**
 * @typedef {Object} AntIndexPoint
 * @property {string} timestamp     - ISO LocalDateTime (KST)
 * @property {number} score         - 0~100
 * @property {('POSITIVE'|'NEUTRAL'|'NEGATIVE')} sentiment
 * @property {number} postCount
 */

/**
 * @typedef {Object} AntIndexLatest
 * @property {string} ticker
 * @property {string} timestamp
 * @property {number} score
 * @property {('POSITIVE'|'NEUTRAL'|'NEGATIVE')} sentiment
 * @property {number} postCount
 */

/**
 * @typedef {Object} AntIndexSeries
 * @property {string} ticker
 * @property {('15m'|'1h'|'1d')} interval
 * @property {AntIndexPoint[]} points
 */

/**
 * @typedef {Object} AntIndexRanking
 * @property {('15m'|'1h'|'24h')} window
 * @property {('positive'|'negative')} direction
 * @property {Array<{ ticker: string, avgScore: number, postCount: number }>} items
 */

export const antIndexApi = {
    /**
     * 최신 개미지수. 데이터 없으면 404 throw.
     * @param {string} ticker
     * @returns {Promise<AntIndexLatest>}
     */
    getLatest: (ticker) =>
        api.get(`/api/ant-index/${ticker}/latest`).then(normalizeKeys),

    /**
     * 개미지수 시계열.
     * @param {string} ticker
     * @param {{from: Date|string, to?: Date|string, interval?: '15m'|'1h'|'1d'}} opts
     * @returns {Promise<AntIndexSeries>}
     */
    getSeries: (ticker, { from, to, interval = '15m' } = {}) => {
        const params = new URLSearchParams();
        params.set('from', toIsoLocal(from));
        if (to) params.set('to', toIsoLocal(to));
        if (interval) params.set('interval', interval);
        return api.get(`/api/ant-index/${ticker}?${params.toString()}`).then(normalizeKeys);
    },

    /**
     * 종목 랭킹.
     * @param {{window?: '15m'|'1h'|'24h', direction?: 'positive'|'negative', limit?: number}} opts
     * @returns {Promise<AntIndexRanking>}
     */
    getRanking: ({ window = '24h', direction = 'positive', limit = 10 } = {}) => {
        const params = new URLSearchParams({ window, direction, limit: String(limit) });
        return api.get(`/api/ant-index/ranking?${params.toString()}`).then(normalizeKeys);
    },
};

// ─────────────────────────────────────────────────────────────────────────
// 시장 zone 매핑 (운영 시스템과 동일).
//   - score 경계는 캡스톤 §5 zone 정의에 따른 [<25 / 25-45 / 45-55 / 55-75 / ≥75]
//   - weight = 권장 주식 비중 (% — 디리스킹 가이드용)
//   - color  = HEX (그라데이션 / 게이지용)
//   - text/bg/border = Tailwind 클래스 (배지·카드용)
//   - 색상 컨벤션: 한국식 (공포·디리스킹=파랑, 탐욕·과열=빨강)
// ─────────────────────────────────────────────────────────────────────────
export const ANT_INDEX_ZONES = [
    {
        id: 'extreme_fear', label: '극공포', weight: 100,
        color: '#1976D2',
        text: 'text-blue-700', bg: 'bg-blue-100',  border: 'border-blue-300',
        match: (s) => s < 25,
    },
    {
        id: 'fear', label: '공포', weight: 100,
        color: '#4FC3F7',
        text: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200',
        match: (s) => s < 45,
    },
    {
        id: 'neutral', label: '중립', weight: 100,
        color: '#FFB300',
        text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200',
        match: (s) => s < 55,
    },
    {
        id: 'greed', label: '탐욕', weight: 60,
        color: '#F57C00',
        text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200',
        match: (s) => s < 75,
    },
    {
        id: 'extreme_greed', label: '극탐욕', weight: 30,
        color: '#C62828',
        text: 'text-red-700', bg: 'bg-red-100', border: 'border-red-300',
        match: () => true,  // s >= 75
    },
];

const UNKNOWN_ZONE = {
    id: 'unknown', label: '데이터 없음', weight: null,
    color: '#94a3b8',
    text: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-200',
};

/**
 * 점수 → zone 객체. null 입력 시 UNKNOWN_ZONE 반환 (UI 안전).
 * @param {number|null|undefined} score
 * @returns {{id: string, label: string, weight: number|null, color: string, text: string, bg: string, border: string}}
 */
export function getAntIndexZone(score) {
    if (score == null) return UNKNOWN_ZONE;
    const s = Number(score);
    return ANT_INDEX_ZONES.find(z => z.match(s)) ?? UNKNOWN_ZONE;
}

// 기존 API 호환을 위한 라벨 함수 (5단계 한 줄 설명).
// 새 코드는 가급적 getAntIndexZone(score).label 직접 사용 권장.
export function getAntIndexLabel(score) {
    return getAntIndexZone(score).label;
}

// 0~100 score → tailwind text-color (한국 컨벤션: 탐욕=red, 공포=blue, 중립=amber)
// 색 경계는 zone 경계(45/55)와 일치시킴.
export function antScoreColorClass(score) {
    if (score == null) return 'text-slate-300';
    const s = Number(score);
    if (s >= 55) return 'text-red-600';
    if (s <  45) return 'text-blue-600';
    return 'text-amber-600';
}

// 한국식 색상 컨벤션: POSITIVE=red(상승) / NEGATIVE=blue(하락) / NEUTRAL=gray
export const SENTIMENT_THEME = {
    POSITIVE: {
        label: '긍정',
        text: 'text-red-600',
        bg:   'bg-red-50',
        border: 'border-red-200',
        chip: 'bg-red-100 text-red-700 border-red-200',
        stroke: '#dc2626',
    },
    NEUTRAL: {
        label: '중립',
        text: 'text-slate-600',
        bg:   'bg-slate-50',
        border: 'border-slate-200',
        chip: 'bg-slate-100 text-slate-700 border-slate-200',
        stroke: '#64748b',
    },
    NEGATIVE: {
        label: '부정',
        text: 'text-blue-600',
        bg:   'bg-blue-50',
        border: 'border-blue-200',
        chip: 'bg-blue-100 text-blue-700 border-blue-200',
        stroke: '#2563eb',
    },
};
