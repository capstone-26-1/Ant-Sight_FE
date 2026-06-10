import { useState, useEffect, useCallback } from 'react';
import {
  X, Sparkles, RefreshCw, TrendingUp, TrendingDown, Minus,
  BrainCircuit, Bookmark, Activity,
} from 'lucide-react';
import { stockApi } from './api/stocks';
import { antIndexApi, SENTIMENT_THEME } from './api/antIndex';

// =========================================================================
// DailySummaryModal
//   하루에 한 번, 사이트 첫 진입 시 자동으로 표시되는 북마크 요약 모달.
//   App.js의 onCloseDailySummary 콜백이 호출되면 localStorage에 오늘 날짜를
//   기록해 같은 날 다시 자동 표시되지 않게 함.
//   "테스트" 버튼(MyPage 등)으로 last-shown 날짜를 초기화하면 다음 진입 시
//   다시 자동으로 떠서 동작 확인 가능. "오늘의 요약" 버튼(DashBoard)으로는
//   언제든 수동 재오픈 가능.
//
// props:
//   bookmarks         - 북마크 배열 (App.js의 공유 상태)
//   onClose           - 닫기 + 오늘 날짜 기록 콜백
//   onNavigateToStock - 종목 클릭 시 호출 (stock → void)
// =========================================================================
export default function DailySummaryModal({ bookmarks = [], onClose, onNavigateToStock }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems]     = useState([]);  // [{ bookmark, quote, ant }]
  const [updatedAt, setUpdatedAt] = useState(null);

  const todayLabel = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  const fetchSummary = useCallback(() => {
    if (bookmarks.length === 0) {
      setLoading(false);
      setItems([]);
      return;
    }
    setLoading(true);
    Promise.all(
      bookmarks.map(b =>
        Promise.all([
          stockApi.getQuote(b.ticker).catch(() => null),
          antIndexApi.getLatest(b.ticker).catch(() => null),
        ]).then(([quote, ant]) => ({ bookmark: b, quote, ant }))
      )
    )
      .then(res => {
        setItems(res);
        setUpdatedAt(new Date());
      })
      .finally(() => setLoading(false));
  }, [bookmarks]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // ── 집계 통계 ──────────────────────────────────────────────────────────
  const validQuotes = items.map(i => i.quote).filter(Boolean);
  const upCount   = validQuotes.filter(q => q.changeAmount > 0).length;
  const downCount = validQuotes.filter(q => q.changeAmount < 0).length;
  const flatCount = validQuotes.length - upCount - downCount;

  const validAnts = items.map(i => i.ant).filter(d => d?.score != null);
  const avgScore  = validAnts.length > 0
    ? validAnts.reduce((s, d) => s + Number(d.score), 0) / validAnts.length
    : null;
  const posCnt = validAnts.filter(d => d.sentiment === 'POSITIVE').length;
  const negCnt = validAnts.filter(d => d.sentiment === 'NEGATIVE').length;
  const neuCnt = validAnts.filter(d => d.sentiment === 'NEUTRAL').length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8 overflow-hidden flex flex-col max-h-[90vh]">

        {/* 헤더 */}
        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-white flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0" />
              <h2 className="text-lg font-extrabold text-slate-900">오늘의 북마크 요약</h2>
            </div>
            <p className="text-xs text-slate-500">{todayLabel}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={fetchSummary}
              disabled={loading}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
              title="새로고침"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="overflow-y-auto p-6 space-y-5">
          {bookmarks.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Bookmark className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium text-slate-600 mb-1">관심 종목이 없습니다.</p>
              <p className="text-sm">종목을 추가하면 매일 자동으로 요약을 보여드립니다.</p>
            </div>
          ) : loading && items.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Activity className="w-10 h-10 mx-auto mb-3 text-slate-300 animate-pulse" />
              <p className="text-sm">데이터를 불러오는 중...</p>
            </div>
          ) : (
            <>
              {/* 집계 카드 3개 */}
              <div className="grid grid-cols-3 gap-3">
                <SummaryStat
                  label="전일 대비"
                  primary={`▲${upCount}`}
                  secondary={`▼${downCount} · ―${flatCount}`}
                  color="text-red-600"
                />
                <SummaryStat
                  label="평균 개미지수"
                  primary={avgScore != null ? avgScore.toFixed(1) : '—'}
                  secondary={validAnts.length > 0 ? `${validAnts.length}개 집계` : '데이터 없음'}
                  color={
                    avgScore == null ? 'text-slate-400'
                    : avgScore >= 60 ? 'text-red-600'
                    : avgScore <= 40 ? 'text-blue-600'
                    : 'text-slate-700'
                  }
                />
                <SummaryStat
                  label="여론 분포"
                  primary={`긍${posCnt} 부${negCnt}`}
                  secondary={`중립 ${neuCnt}`}
                  color="text-slate-700"
                />
              </div>

              {/* 종목별 리스트 */}
              <div className="space-y-2">
                {items.map(({ bookmark, quote, ant }) => (
                  <BookmarkSummaryRow
                    key={bookmark.ticker}
                    bookmark={bookmark}
                    quote={quote}
                    ant={ant}
                    onClick={() => {
                      onClose?.();
                      onNavigateToStock?.(bookmark);
                    }}
                  />
                ))}
              </div>

              {updatedAt && (
                <p className="text-[11px] text-slate-400 text-right">
                  업데이트: {updatedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              )}
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center flex-wrap gap-2">
          <p className="text-[11px] text-slate-400">
            오늘 처음 진입 시 자동으로 표시되며, 같은 날에는 다시 자동 표시되지 않습니다.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-sm font-bold bg-slate-900 text-white hover:bg-slate-700 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 집계 카드 ───────────────────────────────────────────────────────────
function SummaryStat({ label, primary, secondary, color = 'text-slate-700' }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
      <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">{label}</div>
      <div className={`text-lg font-black ${color}`}>{primary}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{secondary}</div>
    </div>
  );
}

// ── 종목별 요약 행 ──────────────────────────────────────────────────────
function BookmarkSummaryRow({ bookmark, quote, ant, onClick }) {
  const isDown = quote ? quote.changeAmount < 0 : false;
  const isFlat = quote ? quote.changeAmount === 0 : false;
  const priceColor = !quote ? 'text-slate-400'
    : isFlat ? 'text-slate-700'
    : isDown ? 'text-blue-600' : 'text-red-600';
  const Arrow = !quote ? Minus : isDown ? TrendingDown : isFlat ? Minus : TrendingUp;

  const score = ant?.score != null ? Number(ant.score) : null;
  const theme = ant?.sentiment ? SENTIMENT_THEME[ant.sentiment] : null;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all text-left"
    >
      {/* 종목 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-bold text-slate-900 truncate">{bookmark.name}</span>
          <span className="text-[10px] text-slate-400 font-mono">{bookmark.ticker}</span>
          {bookmark.market && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              bookmark.market === 'KOSPI'
                ? 'bg-blue-50 text-blue-700 border border-blue-100'
                : 'bg-amber-50 text-amber-700 border border-amber-100'
            }`}>
              {bookmark.market}
            </span>
          )}
        </div>
        {bookmark.sector && (
          <div className="text-[11px] text-slate-400 truncate">{bookmark.sector}</div>
        )}
      </div>

      {/* 가격 */}
      <div className={`text-right ${priceColor} flex-shrink-0 w-28`}>
        <div className="font-bold text-sm flex items-center justify-end gap-1">
          <Arrow className="w-3.5 h-3.5" />
          {quote ? `${quote.currentPrice.toLocaleString()}원` : '--'}
        </div>
        {quote && (
          <div className="text-[11px] font-bold">
            {quote.changeRate > 0 ? '+' : ''}{quote.changeRate.toFixed(2)}%
          </div>
        )}
      </div>

      {/* 개미지수 */}
      <div className="flex-shrink-0 w-24 flex flex-col items-end">
        {score != null ? (
          <>
            <div className={`text-sm font-extrabold flex items-center gap-1 ${theme?.text ?? 'text-slate-700'}`}>
              <BrainCircuit className="w-3.5 h-3.5" />
              {score.toFixed(1)}
            </div>
            {theme && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border mt-0.5 ${theme.chip}`}>
                {theme.label}
              </span>
            )}
          </>
        ) : (
          <span className="text-xs text-slate-300">개미지수 —</span>
        )}
      </div>
    </button>
  );
}
