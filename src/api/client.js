const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:7689';

// snake_case → camelCase 변환기.
// 백엔드(Jackson)가 SNAKE_CASE 설정인 경우 응답이 current_price 형태로 내려올 수 있다.
// 호출부에서 응답에 적용하면 camelCase로 정규화된다. 응답이 이미 camelCase면 no-op.
function snakeToCamel(str) {
    return str.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

export function normalizeKeys(input) {
    if (Array.isArray(input)) return input.map(normalizeKeys);
    if (input !== null && typeof input === 'object') {
        const out = {};
        for (const key of Object.keys(input)) {
            out[snakeToCamel(key)] = normalizeKeys(input[key]);
        }
        return out;
    }
    return input;
}

async function request(path, options = {}) {
    const token = localStorage.getItem('antsight_token');

    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers,
        },
    });

    // 401: 토큰 무효 → 제거 후 전역 이벤트 디스패치
    if (res.status === 401) {
        localStorage.removeItem('antsight_token');
        window.dispatchEvent(new CustomEvent('auth:expired'));
        const body = await res.json().catch(() => null);
        const err = new Error(body?.message || '인증이 만료되었습니다. 다시 로그인해주세요.');
        err.status = 401;
        throw err;
    }

    // 204 No Content
    if (res.status === 204) return null;

    const body = await res.json().catch(() => null);

    if (!res.ok) {
        const err = new Error(body?.message || `요청 실패 (HTTP ${res.status})`);
        err.status = res.status;
        throw err;
    }

    // 공통 응답 포맷 언래핑: { success, data, message }
    if (body && typeof body === 'object' && 'success' in body) {
        if (body.success) return body.data;
        const err = new Error(body.message || '요청에 실패했습니다.');
        err.status = res.status;
        throw err;
    }

    return body;
}

export const api = {
    get:    (path)        => request(path),
    post:   (path, body)  => request(path, { method: 'POST',   body: JSON.stringify(body) }),
    put:    (path, body)  => request(path, { method: 'PUT',    body: JSON.stringify(body) }),
    delete: (path)        => request(path, { method: 'DELETE' }),
};
