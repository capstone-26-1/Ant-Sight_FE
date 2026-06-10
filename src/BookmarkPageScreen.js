import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Bell, Search, Activity,
  Trash2, ChevronDown, Filter, Bookmark, RefreshCw,
  TrendingDown, TrendingUp, BrainCircuit, Check
} from 'lucide-react';
import Sidebar from './Sidebar';
import { stockApi } from './api/stocks';
import { antIndexApi, SENTIMENT_THEME } from './api/antIndex';

// 정렬 옵션. compare(a,b) 시그니처는 (bookmark, quotes, antIndexes) 컨텍스트가 필요해
// 컴포넌트 내부 sortedBookmarks에서 클로저로 처리.
const SORT_OPTIONS = [
  { id: 'default',  label: '추가순 (기본)' },
  { id: 'name',     label: '종목명 가나다순' },
  { id: 'price',    label: '현재가 높은순' },
  { id: 'change',   label: '등락률 높은순' },
  { id: 'antDesc',  label: '개미지수 높은순' },
  { id: 'antAsc',   label: '개미지수 낮은순' },
];

const FILTER_OPTIONS = [
  { id: 'ALL',    label: '전체' },
  { id: 'KOSPI',  label: 'KOSPI만' },
  { id: 'KOSDAQ', label: 'KOSDAQ만' },
];

// =========================================================================
// BookmarkPageScreen - 북마크(관심 종목) 관리 페이지
//
// props:
//   currentPage          - 현재 페이지 이름
//   onNavigate           - 페이지 이동 함수
//   bookmarks            - 북마크 목록 (App.js에서 전달하는 공유 상태)
//   onToggleBookmark     - 북마크 추가/제거 함수 (삭제 버튼에서 사용)
//   unreadCount          - 읽지 않은 알림 수
//   onToggleNotifications - 알림 패널 토글
//
// 핵심 설계:
//   bookmarks 배열은 App.js에서 관리합니다.
//   이 컴포넌트는 그 목록을 표시하고, 삭제 시 onToggleBookmark를 호출합니다.
//   종목 행 클릭 → 탐색 탭에서 인라인으로 상세 표시 (onNavigate('explore', stock))
// =========================================================================
export default function BookmarkPageScreen({
  currentPage,
  onNavigate,
  bookmarks = [],
  onToggleBookmark,
  unreadCount = 0,
  onToggleNotifications,
}) {
  // 종목별 시세 ({ [ticker]: QuoteResponse }). 일괄 조회 API 부재로 N번 병렬 호출.
  const [quotes, setQuotes] = useState({});
  const [quotesLoading, setQuotesLoading] = useState(false);

  // 종목별 최신 개미지수 ({ [ticker]: AntIndexLatest | null }).
  // 데이터 없음(404)도 정상 케이스 → null로 저장.
  const [antIndexes, setAntIndexes] = useState({});

  // 정렬·필터 상태 + 드롭다운 열림 상태
  const [sortId, setSortId]     = useState('default');
  const [filterId, setFilterId] = useState('ALL');
  const [sortOpen, setSortOpen]     = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const sortBoxRef   = useRef(null);
  const filterBoxRef = useRef(null);

  // 드롭다운 바깥 클릭 시 닫기
  useEffect(() => {
    const onClickOutside = (e) => {
      if (sortBoxRef.current   && !sortBoxRef.current.contains(e.target))   setSortOpen(false);
      if (filterBoxRef.current && !filterBoxRef.current.contains(e.target)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // 북마크 시세 + 개미지수 일괄 조회.
  // 5s 폴링은 N배 비용이라 일회 조회 + 수동 새로고침으로 제한.
  const refreshQuotes = useCallback(() => {
    if (bookmarks.length === 0) return;
    setQuotesLoading(true);
    const quotesP = Promise.all(
      bookmarks.map(b =>
        stockApi.getQuote(b.ticker)
          .then(q => [b.ticker, q])
          .catch(() => [b.ticker, null])
      )
    ).then(entries => setQuotes(Object.fromEntries(entries)));

    const antP = Promise.all(
      bookmarks.map(b =>
        antIndexApi.getLatest(b.ticker)
          .then(d => [b.ticker, d])
          .catch(() => [b.ticker, null])  // 404 포함 — "데이터 없음"으로 표시
      )
    ).then(entries => setAntIndexes(Object.fromEntries(entries)));

    Promise.all([quotesP, antP]).finally(() => setQuotesLoading(false));
  }, [bookmarks]);

  useEffect(() => {
    refreshQuotes();
  }, [refreshQuotes]);

  // ── 필터 + 정렬 적용 (메모이즈) ───────────────────────────────────────
  const visibleBookmarks = useMemo(() => {
    const filtered = filterId === 'ALL'
      ? bookmarks
      : bookmarks.filter(b => b.market === filterId);

    // 정렬 — null 값은 항상 후순위로 보냄
    const withMeta = filtered.map((b, idx) => ({
      b,
      idx,
      quote: quotes[b.ticker],
      ant: antIndexes[b.ticker],
    }));

    const cmp = (a, b) => {
      switch (sortId) {
        case 'name':
          return (a.b.name ?? '').localeCompare(b.b.name ?? '', 'ko');
        case 'price': {
          const av = a.quote?.currentPrice ?? -Infinity;
          const bv = b.quote?.currentPrice ?? -Infinity;
          return bv - av;
        }
        case 'change': {
          const av = a.quote?.changeRate ?? -Infinity;
          const bv = b.quote?.changeRate ?? -Infinity;
          return bv - av;
        }
        case 'antDesc': {
          const av = a.ant?.score != null ? Number(a.ant.score) : -Infinity;
          const bv = b.ant?.score != null ? Number(b.ant.score) : -Infinity;
          return bv - av;
        }
        case 'antAsc': {
          const av = a.ant?.score != null ? Number(a.ant.score) : Infinity;
          const bv = b.ant?.score != null ? Number(b.ant.score) : Infinity;
          return av - bv;
        }
        case 'default':
        default:
          return a.idx - b.idx;
      }
    };

    return [...withMeta].sort(cmp).map(x => x.b);
  }, [bookmarks, quotes, antIndexes, sortId, filterId]);

  // ── 요약 통계 ─────────────────────────────────────────────────────────
  const kospiCount  = bookmarks.filter(b => b.market === 'KOSPI').length;
  const kosdaqCount = bookmarks.filter(b => b.market === 'KOSDAQ').length;

  const currentSortLabel   = SORT_OPTIONS.find(o => o.id === sortId)?.label   ?? '기본';
  const currentFilterLabel = FILTER_OPTIONS.find(o => o.id === filterId)?.label ?? '전체';

  // 개미지수 평균 + 분포 (sentiment 카운트). 데이터 없음 종목은 제외.
  const antIndexStats = (() => {
    const valid = Object.values(antIndexes).filter(d => d?.score != null);
    if (valid.length === 0) return null;
    const avg = valid.reduce((sum, d) => sum + Number(d.score), 0) / valid.length;
    const cnt = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 };
    for (const d of valid) cnt[d.sentiment] = (cnt[d.sentiment] ?? 0) + 1;
    return { avg, count: valid.length, ...cnt };
  })();

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">

      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />

      <main className="flex-1 flex flex-col h-screen overflow-y-auto">

        {/* 상단 헤더 */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          {/* 검색창 클릭 시 탐색 페이지로 이동 */}
          <div
            className="flex items-center w-96 relative cursor-pointer"
            onClick={() => onNavigate('explore')}
          >
            <Search className="w-5 h-5 text-slate-400 absolute left-3" />
            <div className="w-full bg-slate-100 rounded-full py-2 pl-10 pr-4 text-sm text-slate-400 select-none">
              관심 종목 내 검색...
            </div>
          </div>
          {/* 알림 벨 버튼 */}
          <button
            className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
            onClick={onToggleNotifications}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full" />
            )}
          </button>
        </header>

        <div className="p-8 max-w-7xl mx-auto w-full space-y-6">

          {/* 페이지 제목 & 추가 버튼 */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">내 북마크 현황</h1>
              <p className="text-sm text-slate-500 mt-1">
                총 {bookmarks.length}개의 종목을 모니터링 중입니다.
              </p>
            </div>
            <button
              className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm"
              onClick={() => onNavigate('explore')}
            >
              + 새 종목 추가
            </button>
          </div>

          {/* ── 요약 위젯 3개 ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* 위젯 1: 총 종목 수 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="text-slate-500 text-sm font-bold flex items-center gap-2 mb-4">
                <Bookmark className="w-4 h-4 text-yellow-500" /> 등록 종목 수
              </div>
              <div>
                <div className="text-4xl font-extrabold text-slate-900 mb-1">
                  {bookmarks.length}<span className="text-lg text-slate-400 font-medium ml-1">개</span>
                </div>
                <p className="text-sm text-slate-500">
                  {bookmarks.length > 0
                    ? '관심 종목으로 등록된 종목 수입니다.'
                    : '관심 종목을 추가하면 여기에 표시됩니다.'}
                </p>
              </div>
            </div>

            {/* 위젯 2: 시장 분포 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="text-slate-500 text-sm font-bold flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-indigo-500" /> 시장 분포
              </div>
              <div className="flex items-end gap-6">
                <div>
                  <div className="text-xs text-slate-400 font-medium mb-1">KOSPI</div>
                  <div className="text-3xl font-extrabold text-blue-600">
                    {kospiCount}
                    <span className="text-lg text-slate-400 font-medium ml-1">개</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium mb-1">KOSDAQ</div>
                  <div className="text-3xl font-extrabold text-amber-600">
                    {kosdaqCount}
                    <span className="text-lg text-slate-400 font-medium ml-1">개</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 위젯 3: 평균 개미지수 (개미지수 분포) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="text-slate-500 text-sm font-bold flex items-center gap-2 mb-4">
                <BrainCircuit className="w-4 h-4 text-indigo-500" /> 평균 개미지수
              </div>
              <div>
                {antIndexStats ? (
                  <>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className={`text-3xl font-extrabold ${
                        antIndexStats.avg >= 60 ? 'text-red-600'
                        : antIndexStats.avg <= 40 ? 'text-blue-600'
                        : 'text-slate-700'
                      }`}>
                        {antIndexStats.avg.toFixed(1)}
                      </span>
                      <span className="text-sm text-slate-400 font-medium">/ 100</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      긍정 {antIndexStats.POSITIVE} · 중립 {antIndexStats.NEUTRAL} · 부정 {antIndexStats.NEGATIVE}
                      <span className="text-slate-400"> ({antIndexStats.count}개 집계)</span>
                    </p>
                  </>
                ) : bookmarks.length === 0 ? (
                  <p className="text-sm text-slate-500 mt-2">등록된 관심 종목이 없습니다.</p>
                ) : (
                  <p className="text-sm text-slate-500 mt-2">개미지수 수집 데이터가 없습니다.</p>
                )}
              </div>
            </div>
          </div>

          {/* ── 관심 종목 상세 테이블 ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {/* 필터 드롭다운 */}
                <div className="relative" ref={filterBoxRef}>
                  <button
                    onClick={() => { setFilterOpen(v => !v); setSortOpen(false); }}
                    className={`flex items-center gap-1 text-sm font-medium border px-3 py-1.5 rounded-lg transition-colors ${
                      filterId !== 'ALL'
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Filter className="w-4 h-4" />
                    필터: {currentFilterLabel}
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  {filterOpen && (
                    <div className="absolute left-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-slate-200 z-20 py-1">
                      {FILTER_OPTIONS.map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => { setFilterId(opt.id); setFilterOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between ${
                            filterId === opt.id ? 'font-bold text-indigo-700' : 'text-slate-700'
                          }`}
                        >
                          {opt.label}
                          {filterId === opt.id && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 시세 새로고침 */}
                <button
                  onClick={refreshQuotes}
                  disabled={quotesLoading || bookmarks.length === 0}
                  className="flex items-center gap-1 text-sm font-medium text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                  title="현재가 / 개미지수 새로고침"
                >
                  <RefreshCw className={`w-4 h-4 ${quotesLoading ? 'animate-spin' : ''}`} />
                  시세 새로고침
                </button>
              </div>

              {/* 정렬 드롭다운 */}
              <div className="relative" ref={sortBoxRef}>
                <button
                  onClick={() => { setSortOpen(v => !v); setFilterOpen(false); }}
                  className={`flex items-center gap-1 text-sm font-medium border px-3 py-1.5 rounded-lg transition-colors ${
                    sortId !== 'default'
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  정렬: {currentSortLabel}
                  <ChevronDown className="w-4 h-4" />
                </button>
                {sortOpen && (
                  <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-slate-200 z-20 py-1">
                    {SORT_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => { setSortId(opt.id); setSortOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between ${
                          sortId === opt.id ? 'font-bold text-indigo-700' : 'text-slate-700'
                        }`}
                      >
                        {opt.label}
                        {sortId === opt.id && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="p-4">종목정보</th>
                    <th className="p-4 text-center">시장</th>
                    <th className="p-4 text-right">현재가</th>
                    <th className="p-4 text-center">개미지수</th>
                    <th className="p-4 text-center">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleBookmarks.length > 0 ? (
                    visibleBookmarks.map((stock) => {
                      const q = quotes[stock.ticker];
                      const isDown = q ? q.changeAmount < 0 : false;
                      const isFlat = q ? q.changeAmount === 0 : false;
                      const priceColor = !q ? 'text-slate-400'
                        : isFlat ? 'text-slate-700'
                        : isDown ? 'text-blue-600' : 'text-red-600';
                      return (
                      <tr
                        key={stock.ticker}
                        className="hover:bg-slate-50 transition-colors group cursor-pointer"
                        onClick={() => onNavigate('explore', stock)}
                      >
                        {/* 종목 정보 */}
                        <td className="p-4">
                          <div className="font-bold text-slate-900 text-base">{stock.name}</div>
                          <div className="text-xs text-slate-500">{stock.ticker}</div>
                        </td>

                        {/* 시장 */}
                        <td className="p-4 text-center">
                          {stock.market && (
                            <span className={`text-xs font-bold px-2 py-1 rounded ${
                              stock.market === 'KOSPI'
                                ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {stock.market}
                            </span>
                          )}
                        </td>

                        {/* 현재가 */}
                        <td className={`p-4 text-right ${priceColor}`}>
                          <div className="font-bold text-sm">
                            {q ? `${q.currentPrice.toLocaleString()}원` : '--'}
                          </div>
                          {q && (
                            <div className="text-xs flex items-center justify-end gap-0.5 mt-0.5">
                              {isDown
                                ? <TrendingDown className="w-3 h-3" />
                                : isFlat ? null : <TrendingUp className="w-3 h-3" />}
                              {q.changeRate > 0 ? '+' : ''}
                              {q.changeRate.toFixed(2)}%
                            </div>
                          )}
                        </td>

                        {/* 개미지수 (실 API: /api/ant-index/{ticker}/latest) */}
                        <td className="p-4 text-center">
                          <AntIndexCell ant={antIndexes[stock.ticker]} />
                        </td>

                        {/* 삭제 */}
                        <td className="p-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-center">
                            <button
                              onClick={() => onToggleBookmark(stock)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                              title="북마크 삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })
                  ) : bookmarks.length > 0 ? (
                    <tr>
                      <td colSpan="5" className="p-12 text-center text-slate-500">
                        <Filter className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                        <p className="text-sm mb-3">필터 조건에 맞는 종목이 없습니다.</p>
                        <button
                          onClick={() => setFilterId('ALL')}
                          className="text-xs font-bold text-indigo-600 hover:underline"
                        >
                          필터 초기화
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan="5" className="p-12 text-center text-slate-500">
                        <Bookmark className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                        <p className="font-medium text-lg text-slate-600 mb-1">
                          관심 종목이 없습니다.
                        </p>
                        <p className="text-sm mb-4">
                          종목을 추가하고 커뮤니티의 개미지수를 모니터링하세요.
                        </p>
                        <button
                          className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors"
                          onClick={() => onNavigate('explore')}
                        >
                          탐색 페이지에서 추가하기
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

// =========================================================================
// AntIndexCell — 북마크 행 개미지수 셀
// ant: AntIndexLatest | null  (null = 데이터 없음 / 미수집)
// =========================================================================
function AntIndexCell({ ant }) {
  if (!ant || ant.score == null) {
    return (
      <span className="text-xs font-medium text-slate-300">—</span>
    );
  }
  const theme = SENTIMENT_THEME[ant.sentiment] ?? SENTIMENT_THEME.NEUTRAL;
  const score = Number(ant.score);
  return (
    <div className="flex items-center justify-center gap-1.5">
      <span className={`text-sm font-extrabold ${theme.text}`}>
        {score.toFixed(1)}
      </span>
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${theme.chip}`}>
        {theme.label}
      </span>
    </div>
  );
}
