import { useState, useEffect, useMemo } from 'react';
import {
  Bell, Search, TrendingDown, TrendingUp,
  Bookmark, ChevronRight, Sparkles
} from 'lucide-react';
import Sidebar from './Sidebar';
import { mt } from './memeTexts';
import { stockApi } from './api/stocks';
import { antIndexApi } from './api/antIndex';
import TOP_100_STOCKS from './top100Stocks.json';
import MarketZoneGauge from './MarketZoneGauge';
import VoljumpCardGrid from './VoljumpCardGrid';

// ticker → 종목명 lookup (랭킹 응답에는 name이 없으므로 클라이언트에서 조인)
const TICKER_NAME_MAP = (() => {
  const m = new Map();
  for (const s of TOP_100_STOCKS) m.set(s.ticker, s.name);
  return m;
})();

const RANK_WINDOW_OPTIONS = [
  { id: '1h',  label: '1시간' },
  { id: '24h', label: '24시간' },
];

// =========================================================================
// DashBoardScreen - 홈 화면
//
// 변경사항:
//   - "현재 시장 개미 지수" 게이지 카드 제거
//   - 종목 클릭 → navigate('explore', stock) (탐색 탭 내 인라인 표시)
//   - 알림 벨 버튼 연결
//   - user prop 제거 (Guest 모드)
//
// props:
//   currentPage          - 현재 페이지
//   onNavigate           - 페이지 이동 함수
//   bookmarks            - 북마크 목록
//   unreadCount          - 읽지 않은 알림 수
//   onToggleNotifications - 알림 패널 토글
//   dashboardData        - 서버 데이터 (null = 로딩 전)
//
// dashboardData 구조 예시:
//   {
//     lastUpdated: "15:30",
//     themeAlerts: [{ id, theme, level, desc, type }],
//     fearTop5:   [{ rank, name, ticker, price, change, score }],
//     greedTop5:  [{ rank, name, ticker, price, change, score }],
//   }
// =========================================================================
export default function DashBoardScreen({
  currentPage,
  onNavigate,
  bookmarks = [],
  unreadCount = 0,
  onToggleNotifications,
  dashboardData = null,
  memeMode = false,
  authUser = null,
  onOpenDailySummary,
}) {
  const [searchInput, setSearchInput] = useState('');

  // 랭킹 window 토글 (15m / 1h / 24h) — 긍정/부정 양쪽에 동일 적용
  const [rankWindow, setRankWindow] = useState('24h');

  // 서버 랭킹 응답 — 비로그인/실패 시 null → dashboardData fallback 사용
  const [positiveRanking, setPositiveRanking] = useState(null); // { window, direction, items }
  const [negativeRanking, setNegativeRanking] = useState(null);
  const [rankingUpdatedAt, setRankingUpdatedAt] = useState(null);

  // 관심 종목 미리보기 시세 ({ [ticker]: QuoteResponse }) — 진입 시 1회 조회.
  const [previewQuotes, setPreviewQuotes] = useState({});

  const isLoggedInUser = authUser?.type === 'user';

  // ── 관심 종목 미리보기(상위 3개) 시세 조회 — 로그인 사용자만 ──────────
  useEffect(() => {
    if (!isLoggedInUser || bookmarks.length === 0) return;
    let cancelled = false;
    const top3 = bookmarks.slice(0, 3);
    Promise.all(
      top3.map(b =>
        stockApi.getQuote(b.ticker)
          .then(q => [b.ticker, q])
          .catch(() => [b.ticker, null])
      )
    ).then(entries => {
      if (cancelled) return;
      setPreviewQuotes(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [isLoggedInUser, bookmarks]);

  const lastUpdated  = rankingUpdatedAt
    ?? dashboardData?.lastUpdated
    ?? null;

  // ── 랭킹 fetch (로그인 사용자만) ─────────────────────────────────────
  useEffect(() => {
    if (!isLoggedInUser) return;
    let cancelled = false;
    Promise.all([
      antIndexApi.getRanking({ window: rankWindow, direction: 'positive', limit: 5 }),
      antIndexApi.getRanking({ window: rankWindow, direction: 'negative', limit: 5 }),
    ])
      .then(([pos, neg]) => {
        if (cancelled) return;
        setPositiveRanking(pos);
        setNegativeRanking(neg);
        setRankingUpdatedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
      })
      .catch(err => {
        if (cancelled || err.status === 401) return;
        // 실패 시 dashboardData 더미로 fallback
        setPositiveRanking(null);
        setNegativeRanking(null);
      });
    return () => { cancelled = true; };
  }, [isLoggedInUser, rankWindow]);

  // 서버 응답 → StockRankTable 포맷 변환 ({rank, name, ticker, score})
  // score는 BE/FE 모두 0~100 스케일 (50=중립).
  const mapRanking = (resp) => (resp?.items ?? []).map((it, i) => ({
    rank: i + 1,
    ticker: it.ticker,
    name: TICKER_NAME_MAP.get(it.ticker) ?? it.ticker,
    score: it.avgScore != null ? Number(it.avgScore) : null,
    postCount: it.postCount,
    // price / change는 ranking API에 없음 → 미표시
    price: null,
    change: null,
  }));

  // 긍정 = 탐욕(greed), 부정 = 공포(fear)
  const greedTop5 = useMemo(
    () => positiveRanking ? mapRanking(positiveRanking) : (dashboardData?.greedTop5 ?? []),
    [positiveRanking, dashboardData]
  );
  const fearTop5 = useMemo(
    () => negativeRanking ? mapRanking(negativeRanking) : (dashboardData?.fearTop5 ?? []),
    [negativeRanking, dashboardData]
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">

      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />

      <main className="flex-1 flex flex-col h-screen overflow-y-auto">

        {/* 상단 헤더 */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          {/* 검색창: 클릭하면 탐색 페이지로 이동 */}
          <div className="flex items-center w-96 relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onFocus={() => onNavigate('explore')}
              placeholder="종목명 또는 티커 검색..."
              className="w-full bg-slate-100 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-slate-900 outline-none cursor-pointer"
              readOnly
            />
          </div>
          {/* 알림 벨 */}
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

        {/* 대시보드 콘텐츠 */}
        <div className="p-8 max-w-7xl mx-auto w-full space-y-6">

          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h1 className="text-2xl font-bold text-slate-900">시장 요약</h1>
            <div className="flex items-center gap-3">
              {isLoggedInUser && bookmarks.length > 0 && onOpenDailySummary && (
                <button
                  onClick={onOpenDailySummary}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-sm"
                  title="오늘의 북마크 요약 보기"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  오늘의 요약
                </button>
              )}
              <p className="text-sm text-slate-500">
                {lastUpdated ? `마지막 업데이트: ${lastUpdated}` : '데이터 로딩 전'}
              </p>
            </div>
          </div>

          {/* ── 시장 zone 게이지 (캡스톤 §5 디리스킹 가이드) ── */}
          <MarketZoneGauge />

          {/* ── 변동성 점프 경보 (Model B — 신규 진입 회피 신호) ── */}
          {isLoggedInUser && (
            <VoljumpCardGrid
              title="변동성 점프 경보 — 신규 진입 회피 신호"
              minProb={0.1}
              limit={12}
              onSelect={(stock) => onNavigate('explore', stock)}
            />
          )}

          {/* ── 공포 / 탐욕 TOP 5 ── */}
          <div className="space-y-3">
            {/* window 토글 — 로그인 사용자에게만 노출 (게스트는 더미 fallback) */}
            {isLoggedInUser && (
              <div className="flex justify-end">
                <div className="inline-flex bg-slate-100 p-0.5 rounded-lg">
                  {RANK_WINDOW_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setRankWindow(opt.id)}
                      className={`px-3 py-1 text-xs rounded-md font-bold transition-all ${
                        rankWindow === opt.id
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 공포 TOP 5 — 부정 (negative direction) */}
              <StockRankTable
                title={mt('fear_top5_title', memeMode)}
                icon={<TrendingDown className="w-5 h-5 text-blue-500" />}
                stocks={fearTop5}
                scoreColor="blue"
                onStockClick={(stock) => onNavigate('explore', stock)}
                onMoreClick={() => onNavigate('explore')}
              />

              {/* 탐욕 TOP 5 — 긍정 (positive direction) */}
              <StockRankTable
                title={mt('greed_top5_title', memeMode)}
                icon={<TrendingUp className="w-5 h-5 text-red-500" />}
                stocks={greedTop5}
                scoreColor="red"
                onStockClick={(stock) => onNavigate('explore', stock)}
                onMoreClick={() => onNavigate('explore')}
              />
            </div>
          </div>

          {/* ── 관심 종목 미리보기 ── */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-slate-700" />
                내 관심 종목
              </h2>
              <button
                className="text-sm text-slate-500 flex items-center hover:text-slate-800"
                onClick={() => onNavigate('bookmark')}
              >
                관리 <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {bookmarks.length > 0 ? (
                bookmarks.slice(0, 3).map((item) => {
                  const q = previewQuotes[item.ticker];
                  const isDown = q ? q.changeAmount < 0 : false;
                  const isFlat = q ? q.changeAmount === 0 : false;
                  const priceColor = !q ? 'text-slate-400'
                    : isFlat ? 'text-slate-700'
                    : isDown ? 'text-blue-500' : 'text-red-500';
                  return (
                  <div
                    key={item.ticker}
                    className="flex items-center justify-between p-4 border border-slate-100 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => onNavigate('explore', item)}
                  >
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-800 truncate">{item.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-sm font-semibold ${priceColor}`}>
                          {q ? `${q.currentPrice.toLocaleString()}원` : '--'}
                        </span>
                        {q && (
                          <span className={`text-xs font-bold ${priceColor}`}>
                            {q.changeRate > 0 ? '+' : ''}{q.changeRate.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <div className="text-xs text-slate-400 mb-1">{item.ticker}</div>
                      {item.market && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          item.market === 'KOSPI'
                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {item.market}
                        </span>
                      )}
                    </div>
                  </div>
                  );
                })
              ) : (
                <div className="col-span-3 text-center py-8 text-slate-400">
                  <Bookmark className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">관심 종목을 추가하면 여기에 표시됩니다.</p>
                  <button
                    className="mt-3 text-sm text-indigo-600 font-medium hover:underline"
                    onClick={() => onNavigate('explore')}
                  >
                    종목 탐색하러 가기 →
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

// ── 재사용 테이블 컴포넌트 ──────────────────────────────────────────────
function StockRankTable({ title, icon, stocks, scoreColor, onStockClick, onMoreClick }) {
  const scoreBg   = scoreColor === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700';
  const changeCls = scoreColor === 'blue' ? 'text-blue-500' : 'text-red-500';

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">{icon}{title}</h2>
        <button className="text-sm text-slate-500 hover:text-slate-800" onClick={onMoreClick}>
          더보기
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50">
            <tr>
              <th className="px-4 py-3 rounded-tl-lg">종목</th>
              <th className="px-4 py-3">현재가</th>
              <th className="px-4 py-3 text-right rounded-tr-lg">지수</th>
            </tr>
          </thead>
          <tbody>
            {stocks.length > 0 ? (
              stocks.map((stock) => (
                <tr
                  key={stock.ticker}
                  className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => onStockClick(stock)}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-center text-slate-400">{stock.rank}</span>
                      {stock.name}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{stock.price != null ? `${stock.price.toLocaleString()}원` : '--'}</div>
                    <div className={`text-xs ${changeCls}`}>{stock.change ?? '--'}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-bold px-2.5 py-1 rounded-md ${scoreBg}`}>
                      {stock.score != null ? Number(stock.score).toFixed(1) : '--'}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="px-4 py-8 text-center text-slate-400 text-sm">
                  데이터를 불러오는 중...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
