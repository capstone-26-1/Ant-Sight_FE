import { api, normalizeKeys } from './client';

// =========================================================================
// Voljump (Model B) — 변동성 점프 경보 API
//   - 일배치 적재 (영업일 18:00 KST), BE 1h in-memory 캐시
//   - 화이트리스트 55종목만 적재. 외 종목은 /{ticker} 호출 시 404.
//   - normalizeKeys 가 snake_case → camelCase 자동 변환
//     (base_day → baseDay, jump_prob → jumpProb, scored_at → scoredAt 등)
//
// 활용: "신규 진입 회피 신호" — 매매 추천 X (UX 카피 가이드).
// =========================================================================

/**
 * @typedef {('HIGH'|'MEDIUM'|'LOW'|null)} VoljumpSeverity
 * @typedef {('VALID'|'STALE'|'OOU')} VoljumpStatus
 */

/**
 * @typedef {Object} VoljumpItem
 * @property {string} ticker
 * @property {number} jumpProb   - 0~1
 * @property {number} posts
 * @property {number} disp       - 0~1 의견 분산
 * @property {VoljumpStatus} status
 * @property {VoljumpSeverity} severity
 */

/**
 * @typedef {Object} VoljumpToday
 * @property {string|null} baseDay     - YYYY-MM-DD, 빈 데이터면 null
 * @property {string|null} scoredAt    - ISO LocalDateTime (KST), 빈 데이터면 null
 * @property {VoljumpItem[]} items
 * @property {string|null} message     - envelope-level (빈 응답 시 안내 메시지)
 */

/**
 * @typedef {Object} VoljumpDetail
 * @property {string} ticker
 * @property {string} baseDay
 * @property {string} scoredAt
 * @property {number} jumpProb
 * @property {number} posts
 * @property {number} disp
 * @property {VoljumpStatus} status
 * @property {VoljumpSeverity} severity
 */

/**
 * @typedef {Object} VoljumpHistoryPoint
 * @property {string} baseDay
 * @property {number} jumpProb
 * @property {VoljumpStatus} status
 */

/**
 * @typedef {Object} VoljumpHistory
 * @property {string} ticker
 * @property {VoljumpHistoryPoint[]} points  - base_day ASC
 */

// 빈 today 응답 판별. data.baseDay === null 이면 배치 미실행 상태.
export function isVoljumpTodayEmpty(today) {
    return !today || today.baseDay == null;
}

export const voljumpApi = {
    /**
     * 오늘 (=최신 VALID base_day) 변동성 경보 종목 리스트.
     * @param {{minProb?: number, limit?: number}} opts
     * @returns {Promise<VoljumpToday>}
     */
    getToday: ({ minProb = 0.2, limit = 50 } = {}) => {
        const params = new URLSearchParams({
            min_prob: String(minProb),
            limit:    String(limit),
        });
        // BE 가 빈 응답에 envelope.message 를 채우지만 client.js 는 data 만 언래핑.
        // 빈 케이스는 data.baseDay === null 로 분기 가능 (isVoljumpTodayEmpty 활용).
        return api.get(`/api/voljump/today?${params.toString()}`).then(normalizeKeys);
    },

    /**
     * 특정 종목 최신 경보. 화이트리스트 외 종목 → 404.
     * @param {string} ticker
     * @returns {Promise<VoljumpDetail>}
     */
    getDetail: (ticker) =>
        api.get(`/api/voljump/${ticker}`).then(normalizeKeys),

    /**
     * 종목 N일 추이. 주말·휴일은 응답 누락 → FE 에서 채움.
     * @param {string} ticker
     * @param {{days?: number}} opts
     * @returns {Promise<VoljumpHistory>}
     */
    getHistory: (ticker, { days = 30 } = {}) => {
        const params = new URLSearchParams({ days: String(days) });
        return api.get(`/api/voljump/history/${ticker}?${params.toString()}`).then(normalizeKeys);
    },
};

// ── 표시 테마 ─────────────────────────────────────────────────────────────
// 한국식 색상 컨벤션과 무관하게 "경보 수준" 의미로 표준 신호 색상 사용:
//   HIGH=빨강(경고) / MEDIUM=황색(주의) / LOW=회색(안정) / null=회색
export const SEVERITY_THEME = {
    HIGH: {
        label: 'HIGH',
        description: '신규 진입 회피 권장',
        text:   'text-red-700',
        bg:     'bg-red-50',
        border: 'border-red-200',
        chip:   'bg-red-100 text-red-700 border-red-200',
        dot:    '#dc2626',
    },
    MEDIUM: {
        label: 'MEDIUM',
        description: '주의',
        text:   'text-amber-700',
        bg:     'bg-amber-50',
        border: 'border-amber-200',
        chip:   'bg-amber-100 text-amber-700 border-amber-200',
        dot:    '#d97706',
    },
    LOW: {
        label: 'LOW',
        description: '안정',
        text:   'text-slate-600',
        bg:     'bg-slate-50',
        border: 'border-slate-200',
        chip:   'bg-slate-100 text-slate-600 border-slate-200',
        dot:    '#64748b',
    },
};

// status != 'VALID' 일 때의 회색 처리 테마 (UI 회색 + 툴팁용)
export const STATUS_FALLBACK_THEME = {
    label: '데이터 비유효',
    text:   'text-slate-400',
    bg:     'bg-slate-100',
    border: 'border-slate-200',
    chip:   'bg-slate-100 text-slate-400 border-slate-200',
    dot:    '#cbd5e1',
};

export const STATUS_TOOLTIP = {
    VALID: '정상 추론 결과',
    STALE: '데이터 갱신 지연 (모델 신선도 만료)',
    OOU:   '분석 대상 외 종목 (Out-Of-Universe)',
};

// jump_prob → 표시용 % (소수 1자리)
export function fmtJumpProb(p) {
    if (p == null || Number.isNaN(p)) return '—';
    return `${(Number(p) * 100).toFixed(1)}%`;
}
