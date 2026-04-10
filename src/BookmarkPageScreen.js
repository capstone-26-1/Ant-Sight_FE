import { useState } from 'react';
import {
  Bell, Search, TrendingDown, TrendingUp, Activity,
  Trash2, BellOff, ChevronDown, Filter, AlertTriangle, Flame, Bookmark
} from 'lucide-react';
import Sidebar from './Sidebar';

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
  // 각 종목별 알림 on/off 상태 (키: ticker, 값: boolean)
  const [alertStates, setAlertStates] = useState({});

  // 알림 토글 함수
  const toggleAlert = (ticker) => {
    setAlertStates(prev => ({
      ...prev,
      [ticker]: !(prev[ticker] ?? true),
    }));
  };

  // ── 요약 통계 계산 ─────────────────────────────────────────────────────
  const validScores = bookmarks.filter(item => item.score != null);
  const avgScore = validScores.length > 0
    ? Math.round(validScores.reduce((acc, curr) => acc + curr.score, 0) / validScores.length)
    : null;
  const fearCount  = bookmarks.filter(item => (item.score ?? 0) < -50).length;
  const greedCount = bookmarks.filter(item => (item.score ?? 0) > 50).length;
  const extremeStock = bookmarks.length > 0
    ? [...bookmarks].sort((a, b) => Math.abs(b.score ?? 0) - Math.abs(a.score ?? 0))[0]
    : null;

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

            {/* 위젯 1: 평균 개미 지수 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div className="text-slate-500 text-sm font-bold flex items-center gap-2">
                  <Activity className="w-4 h-4" /> 내 관심종목 평균 온도
                </div>
                {avgScore != null && (
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-lg ${
                    avgScore < 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {avgScore < 0 ? '공포 우위' : '탐욕 우위'}
                  </span>
                )}
              </div>
              <div>
                <div className="text-4xl font-extrabold text-slate-900 mb-1">
                  {avgScore ?? '--'}
                </div>
                <p className="text-sm text-slate-500">
                  {bookmarks.length > 0
                    ? '관심 종목들의 전반적인 커뮤니티 여론입니다.'
                    : '관심 종목을 추가하면 평균 온도가 표시됩니다.'}
                </p>
              </div>
            </div>

            {/* 위젯 2: 여론 급변 종목 수 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div className="text-slate-500 text-sm font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" /> 여론 급변 종목
                </div>
              </div>
              <div className="flex items-end gap-6">
                <div>
                  <div className="text-xs text-slate-400 font-medium mb-1">비명 (공포 절정)</div>
                  <div className="text-3xl font-extrabold text-blue-600">
                    {fearCount}
                    <span className="text-lg text-slate-400 font-medium ml-1">개</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium mb-1">광기 (가즈아)</div>
                  <div className="text-3xl font-extrabold text-red-600">
                    {greedCount}
                    <span className="text-lg text-slate-400 font-medium ml-1">개</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 위젯 3: 가장 극단적인 여론 종목 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div className="text-slate-500 text-sm font-bold flex items-center gap-2">
                  <Flame className="w-4 h-4 text-red-500" /> 가장 극단적인 여론
                </div>
              </div>
              <div>
                {extremeStock ? (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl font-bold text-slate-900">{extremeStock.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        (extremeStock.score ?? 0) < 0
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {extremeStock.score != null
                          ? (extremeStock.score > 0 ? `+${extremeStock.score}` : extremeStock.score)
                          : '--'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">
                      현재 포트폴리오 중 가장 여론이 과열되었습니다.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500 mt-2">등록된 관심 종목이 없습니다.</p>
                )}
              </div>
            </div>
          </div>

          {/* ── 관심 종목 상세 테이블 ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1 text-sm font-medium text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50">
                  <Filter className="w-4 h-4" /> 필터
                </button>
              </div>
              <div className="text-sm text-slate-500 flex items-center gap-1">
                기본 정렬 <ChevronDown className="w-4 h-4" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="p-4">종목정보</th>
                    <th className="p-4 text-right">현재가</th>
                    <th className="p-4 text-center">개미 지수</th>
                    <th className="p-4 text-center">알림 상태</th>
                    <th className="p-4 text-center">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bookmarks.length > 0 ? (
                    bookmarks.map((stock) => (
                      // 행 클릭 → 탐색 탭으로 이동 후 해당 종목 인라인 상세 표시
                      <tr
                        key={stock.ticker}
                        className="hover:bg-slate-50 transition-colors group cursor-pointer"
                        onClick={() => onNavigate('explore', stock)}
                      >
                        {/* 종목 정보 */}
                        <td className="p-4">
                          <div className="font-bold text-slate-900 text-base">{stock.name}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-2">
                            <span>{stock.ticker}</span>
                            {stock.category && (
                              <>
                                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                <span>{stock.category}</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* 현재가 & 등락 */}
                        <td className="p-4 text-right">
                          <div className="font-bold text-slate-900">
                            {stock.price != null ? stock.price.toLocaleString() : '--'}
                          </div>
                          <div className={`text-xs font-medium flex items-center justify-end gap-1 ${
                            stock.isDown ? 'text-blue-500' : 'text-red-500'
                          }`}>
                            {stock.isDown
                              ? <TrendingDown className="w-3 h-3" />
                              : <TrendingUp className="w-3 h-3" />}
                            {stock.changeAmount != null
                              ? `${stock.changeAmount > 0 ? '+' : ''}${stock.changeAmount.toLocaleString()} (${stock.change ?? '--'})`
                              : '--'}
                          </div>
                        </td>

                        {/* 개미 지수 배지 */}
                        <td className="p-4">
                          <div className="flex justify-center">
                            <div className={`flex items-center justify-center w-16 h-10 rounded-lg border font-black text-sm ${
                              (stock.score ?? 0) > 50
                                ? 'bg-red-50 border-red-200 text-red-700'
                                : (stock.score ?? 0) < -50
                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}>
                              {stock.score != null
                                ? (stock.score > 0 ? `+${stock.score}` : stock.score)
                                : '--'}
                            </div>
                          </div>
                        </td>

                        {/* 알림 토글 버튼 - e.stopPropagation()으로 행 클릭 이벤트 차단 */}
                        <td className="p-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-center">
                            <button
                              onClick={() => toggleAlert(stock.ticker)}
                              className={`p-2 rounded-full transition-colors ${
                                (alertStates[stock.ticker] ?? true)
                                  ? 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                              }`}
                              title={(alertStates[stock.ticker] ?? true) ? '알림 켜짐' : '알림 꺼짐'}
                            >
                              {(alertStates[stock.ticker] ?? true)
                                ? <Bell className="w-4 h-4 fill-current" />
                                : <BellOff className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>

                        {/* 삭제 버튼 - e.stopPropagation()으로 행 클릭 이벤트 차단 */}
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
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="p-12 text-center text-slate-500">
                        <Bookmark className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                        <p className="font-medium text-lg text-slate-600 mb-1">
                          관심 종목이 없습니다.
                        </p>
                        <p className="text-sm mb-4">
                          종목을 추가하고 커뮤니티의 비명 지수를 모니터링하세요.
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
