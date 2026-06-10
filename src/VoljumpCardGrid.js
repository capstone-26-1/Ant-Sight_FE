import { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, RefreshCw, AlertTriangle, Info } from 'lucide-react';
import {
  voljumpApi, isVoljumpTodayEmpty,
  SEVERITY_THEME, STATUS_FALLBACK_THEME, STATUS_TOOLTIP, fmtJumpProb,
} from './api/voljump';
import STOCK_CODES from './stockCodes.json';

// ticker → 종목명 lookup (응답에는 name 없음)
const NAME_MAP = (() => {
  const m = new Map();
  for (const s of STOCK_CODES) m.set(s.ticker, s);
  return m;
})();

// =========================================================================
// VoljumpCardGrid — 변동성 점프 경보 종목 카드 그리드
//
// 데이터: voljumpApi.getToday({ minProb, limit })
// 폴링: 1시간 (일배치라 더 짧게 무의미). 사용자 새로고침은 항상 가능.
// 빈 응답(data.baseDay === null) → "오늘 적재 데이터 없음" 안내.
//
// 발표 환경 권장: minProb=0.1 (HIGH ≥0.4 종목이 거의 없어 노출량 확보)
//
// props:
//   title      - 섹션 제목 (Dashboard / AntStrategy 컨텍스트별 카피)
//   minProb    - 기본 0.1 (시연 데이터 분포 보수적)
//   limit      - 기본 20
//   onSelect   - 카드 클릭 시 호출 (stock → void). 기본은 노옵.
//   compact    - true 면 작은 카드 형태
// =========================================================================
const POLL_MS = 60 * 60 * 1000;  // 1h. BE 캐시 TTL과 동일.

export default function VoljumpCardGrid({
  title = '변동성 경보',
  minProb = 0.1,
  limit = 20,
  onSelect,
  compact = false,
  enabled = true,
}) {
  const [today, setToday]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchToday = useCallback(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    voljumpApi.getToday({ minProb, limit })
      .then(data => {
        setToday(data);
        setError(null);
      })
      .catch(err => {
        if (err.status === 401) return;
        setError(err.message || '경보 데이터를 불러오지 못했습니다.');
      })
      .finally(() => setLoading(false));
  }, [enabled, minProb, limit]);

  useEffect(() => {
    fetchToday();
    if (!enabled) return;
    const id = setInterval(fetchToday, POLL_MS);
    return () => clearInterval(id);
  }, [fetchToday, enabled, refreshKey]);

  const empty = isVoljumpTodayEmpty(today);
  const items = today?.items ?? [];

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="w-5 h-5 text-rose-500 flex-shrink-0" />
          <h2 className="font-bold text-slate-900 truncate">{title}</h2>
          {today?.baseDay && (
            <span className="text-xs text-slate-400">
              · {today.baseDay} 기준 {items.length}개
            </span>
          )}
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={loading}
          className="flex items-center gap-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 px-2 py-1.5 rounded-lg hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {error ? (
        <div className="px-5 py-6 text-sm text-red-500 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      ) : empty ? (
        <div className="px-5 py-10 text-center text-slate-400">
          <ShieldAlert className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-medium text-slate-600 mb-1">
            {today?.message ?? '오늘 적재 데이터 없음 (배치 대기 중)'}
          </p>
          <p className="text-[11px] text-slate-400">
            일배치 (영업일 18:00 KST) 후 표시됩니다.
          </p>
        </div>
      ) : (
        <div className={`p-4 grid gap-2 grid-cols-1 sm:grid-cols-2 ${compact ? 'lg:grid-cols-3' : 'lg:grid-cols-3 xl:grid-cols-4'}`}>
          {items.map(item => (
            <VoljumpCard
              key={item.ticker}
              item={item}
              onClick={() => onSelect?.({
                ticker: item.ticker,
                name: NAME_MAP.get(item.ticker)?.name ?? item.ticker,
              })}
            />
          ))}
        </div>
      )}

      {!empty && !error && (
        <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/50 flex items-center gap-1.5 text-[10px] text-slate-500">
          <Info className="w-3 h-3 flex-shrink-0" />
          다음 영업일에 일일 변동성이 평소보다 크게 튈 확률입니다. 매매 추천이 아닙니다.
        </div>
      )}
    </section>
  );
}

// ── 개별 카드 ────────────────────────────────────────────────────────────
function VoljumpCard({ item, onClick }) {
  const meta = NAME_MAP.get(item.ticker);
  const name = meta?.name ?? item.ticker;
  const isValid = item.status === 'VALID';
  const theme = isValid && item.severity
    ? SEVERITY_THEME[item.severity] ?? STATUS_FALLBACK_THEME
    : STATUS_FALLBACK_THEME;

  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl p-3 border transition-all hover:shadow-sm ${theme.bg} ${theme.border}`}
      title={!isValid ? STATUS_TOOLTIP[item.status] : SEVERITY_THEME[item.severity]?.description}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm text-slate-900 truncate">{name}</div>
          <div className="text-[10px] text-slate-500 font-mono">{item.ticker}</div>
        </div>
        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border flex-shrink-0 ${theme.chip}`}>
          {isValid ? (item.severity ?? '—') : item.status}
        </span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className={`text-2xl font-black ${theme.text}`}>{fmtJumpProb(item.jumpProb)}</span>
        <span className="text-[10px] text-slate-500">
          글 {item.posts.toLocaleString()} · 분산 {(item.disp * 100).toFixed(0)}%
        </span>
      </div>
      {!isValid && (
        <div className="text-[10px] text-slate-500 mt-1">
          {STATUS_TOOLTIP[item.status]}
        </div>
      )}
    </button>
  );
}
