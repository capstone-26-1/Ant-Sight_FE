import { useState } from 'react';
import {
  Bell, Search, TrendingDown, TrendingUp,
  Zap, Bookmark, ChevronRight
} from 'lucide-react';
import Sidebar from './Sidebar';

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
}) {
  const [searchInput, setSearchInput] = useState('');

  const lastUpdated  = dashboardData?.lastUpdated  ?? null;
  const themeAlerts  = dashboardData?.themeAlerts  ?? [];
  const fearTop5     = dashboardData?.fearTop5     ?? [];
  const greedTop5    = dashboardData?.greedTop5    ?? [];

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

          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-slate-900">시장 요약</h1>
            <p className="text-sm text-slate-500">
              {lastUpdated ? `마지막 업데이트: ${lastUpdated}` : '데이터 로딩 전'}
            </p>
          </div>

          {/* ── 급등락 테마 알림 (전체 너비) ── */}
          {/* 개미지수 게이지가 삭제되어 테마 알림이 상단 전체 차지 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-yellow-500" />
              급등락 테마 알림
            </h2>
            {themeAlerts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {themeAlerts.map(alert => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-xl border ${
                      alert.type === 'fear'
                        ? 'bg-blue-50 border-blue-100'
                        : 'bg-red-50 border-red-100'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-slate-800">{alert.theme}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        alert.type === 'fear'
                          ? 'bg-blue-200 text-blue-800'
                          : 'bg-red-200 text-red-800'
                      }`}>
                        {alert.level}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{alert.desc}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <Zap className="w-8 h-8 mb-2 text-slate-300" />
                <p className="text-sm">테마 알림 데이터를 불러오는 중...</p>
              </div>
            )}
          </div>

          {/* ── 공포 / 탐욕 TOP 5 ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* 공포 TOP 5 */}
            <StockRankTable
              title="실시간 비명(공포) TOP 5"
              icon={<TrendingDown className="w-5 h-5 text-blue-500" />}
              stocks={fearTop5}
              scoreColor="blue"
              // 종목 클릭 → 탐색 탭 열기 + 해당 종목 인라인 표시
              onStockClick={(stock) => onNavigate('explore', stock)}
              onMoreClick={() => onNavigate('explore')}
            />

            {/* 탐욕 TOP 5 */}
            <StockRankTable
              title="실시간 광기(탐욕) TOP 5"
              icon={<TrendingUp className="w-5 h-5 text-red-500" />}
              stocks={greedTop5}
              scoreColor="red"
              onStockClick={(stock) => onNavigate('explore', stock)}
              onMoreClick={() => onNavigate('explore')}
            />
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
                bookmarks.slice(0, 3).map((item) => (
                  <div
                    key={item.ticker}
                    className="flex items-center justify-between p-4 border border-slate-100 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => onNavigate('explore', item)}
                  >
                    <div>
                      <h3 className="font-bold text-slate-800">{item.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-slate-500">
                          {item.price != null ? item.price.toLocaleString() : '--'}
                        </span>
                        <span className={`text-xs font-medium ${
                          String(item.change ?? '').startsWith('+') ? 'text-red-500' : 'text-blue-500'
                        }`}>
                          {item.change ?? '--'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400 mb-1">개미 지수</div>
                      <span className={`font-bold px-2 py-1 rounded text-xs ${
                        (item.score ?? 0) > 50  ? 'bg-red-100 text-red-700' :
                        (item.score ?? 0) < -50 ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {item.score != null
                          ? (item.score > 0 ? `+${item.score}` : item.score)
                          : '--'}
                      </span>
                    </div>
                  </div>
                ))
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
                      {stock.score != null
                        ? (stock.score > 0 ? `+${stock.score}` : stock.score)
                        : '--'}
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
