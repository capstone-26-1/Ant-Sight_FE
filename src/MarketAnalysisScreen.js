import { Activity, BrainCircuit, TrendingDown, TrendingUp, Bell, AlertTriangle } from 'lucide-react';
import Sidebar from './Sidebar';

// =========================================================================
// MarketAnalysisScreen - 시장 분석 페이지
//
// 전체 시장의 개미 지수 및 AI 분석 결과를 표시합니다.
// (기존 "종목 분석" 탭이 "시장 분석"으로 변경된 화면)
//
// props:
//   currentPage          - 현재 페이지 이름
//   onNavigate           - 페이지 이동 함수
//   unreadCount          - 읽지 않은 알림 수
//   onToggleNotifications - 알림 패널 토글 함수
//   analysisData         - 서버에서 받아올 분석 데이터 (현재는 null)
//
// analysisData 구조 예시 (서버 연동 시):
//   {
//     antIndex:    -68,         // 전체 시장 개미 지수 (-100~100)
//     lastUpdated: "15:30",     // 마지막 분석 시간
//     aiSummary:   "현재 시장은...", // AI 분석 요약
//     sectors: [               // 섹터별 감성
//       { name: '반도체', score: -45, trend: '하락' },
//       ...
//     ],
//     fearKeywords:  ['투매', '손절', ...], // 공포 키워드
//     greedKeywords: ['가즈아', '물타기', ...], // 탐욕 키워드
//   }
// =========================================================================
export default function MarketAnalysisScreen({
  currentPage,
  onNavigate,
  unreadCount = 0,
  onToggleNotifications,
  analysisData = null,
}) {
  // 서버 데이터 추출 (null이면 기본값)
  const antIndex   = analysisData?.antIndex   ?? null;
  const lastUpdated = analysisData?.lastUpdated ?? null;
  const aiSummary  = analysisData?.aiSummary  ?? null;
  const sectors    = analysisData?.sectors    ?? [];

  // antIndex → 레이블 변환
  const getIndexLabel = (idx) => {
    if (idx == null) return '데이터 로딩 전';
    if (idx <= -80)  return '극단적 공포 (비명 절정)';
    if (idx <= -50)  return '공포';
    if (idx <   0)   return '중립 (약세)';
    if (idx <=  50)  return '중립 (강세)';
    if (idx <=  80)  return '탐욕';
    return '극단적 탐욕 (광기)';
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">

      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />

      <main className="flex-1 flex flex-col h-screen overflow-y-auto">

        {/* 상단 헤더 */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="text-lg font-bold text-slate-900">시장 분석</div>
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

        <div className="p-8 max-w-6xl mx-auto w-full space-y-6">

          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">전체 시장 개미 지수</h1>
            <p className="text-sm text-slate-500">
              {lastUpdated ? `마지막 분석: ${lastUpdated}` : '서버 연동 전'}
            </p>
          </div>

          {/* ── 시장 개미 지수 메인 카드 ── */}
          <div className="bg-slate-900 text-white rounded-2xl p-8 border border-slate-800 shadow-lg relative overflow-hidden">
            <div className="absolute -right-16 -top-16 w-48 h-48 bg-blue-500 rounded-full blur-[80px] opacity-10 pointer-events-none" />
            <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-indigo-500 rounded-full blur-[60px] opacity-10 pointer-events-none" />

            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-6 h-6 text-indigo-400" />
              <h2 className="text-xl font-bold tracking-tight">시장 전체 개미 지수 (Market Ant Index)</h2>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
              <div>
                {/* 지수 값 */}
                {antIndex !== null ? (
                  <>
                    <div className={`text-6xl font-black mb-2 ${antIndex < 0 ? 'text-blue-400' : 'text-red-400'}`}>
                      {antIndex > 0 ? `+${antIndex}` : antIndex}
                    </div>
                    <div className={`text-lg font-bold ${antIndex < 0 ? 'text-blue-300' : 'text-red-300'}`}>
                      {getIndexLabel(antIndex)}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-6xl font-black text-slate-600 mb-2">--</div>
                    <div className="text-lg font-bold text-slate-500">서버 데이터 연동 후 표시됩니다.</div>
                  </>
                )}
              </div>

              {/* 방향 아이콘 */}
              <div className="hidden md:flex items-center justify-center w-24 h-24 rounded-full bg-slate-800/50 border border-slate-700">
                {antIndex !== null ? (
                  antIndex < 0
                    ? <TrendingDown className="w-12 h-12 text-blue-400" />
                    : <TrendingUp   className="w-12 h-12 text-red-400" />
                ) : (
                  <Activity className="w-12 h-12 text-slate-600" />
                )}
              </div>
            </div>

            {/* 게이지 바 */}
            <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden mb-2">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-slate-600 to-red-500 opacity-60" />
              {antIndex !== null && (
                <div
                  className="absolute top-0 bottom-0 w-2 bg-white rounded-full shadow-lg"
                  style={{ left: `calc(${(antIndex + 100) / 2}% - 4px)` }}
                />
              )}
            </div>
            <div className="flex justify-between text-xs text-slate-500 font-medium">
              <span>-100 (극단적 공포)</span>
              <span>0 (중립)</span>
              <span>+100 (극단적 탐욕)</span>
            </div>
          </div>

          {/* ── AI 분석 리포트 ── */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <BrainCircuit className="w-5 h-5 text-indigo-500" />
              <h2 className="text-lg font-bold text-slate-900">AI 시장 분석 리포트</h2>
            </div>

            {aiSummary ? (
              <p className="text-slate-600 leading-relaxed">{aiSummary}</p>
            ) : (
              // 서버 데이터 없을 때 플레이스홀더
              <div className="space-y-3">
                <div className="h-4 bg-slate-100 rounded-full w-full animate-pulse" />
                <div className="h-4 bg-slate-100 rounded-full w-5/6 animate-pulse" />
                <div className="h-4 bg-slate-100 rounded-full w-4/6 animate-pulse" />
                <p className="text-slate-400 text-sm text-center pt-4">
                  AI 분석 데이터를 불러오는 중입니다.<br />
                  서버 연동 후 실시간 분석 리포트가 여기에 표시됩니다.
                </p>
              </div>
            )}
          </div>

          {/* ── 섹터별 감성 지수 ── */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              섹터별 개미 지수
            </h2>

            {sectors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sectors.map((sector) => (
                  <div key={sector.name} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-800">{sector.name}</span>
                      <span className={`font-black text-lg ${sector.score < 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {sector.score > 0 ? `+${sector.score}` : sector.score}
                      </span>
                    </div>
                    <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-slate-300 to-red-500 opacity-40" />
                      <div
                        className="absolute top-0 bottom-0 w-1.5 bg-slate-900 rounded-full"
                        style={{ left: `${(sector.score + 100) / 2}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{sector.trend}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Activity className="w-10 h-10 mb-3 text-slate-300" />
                <p className="text-sm">섹터별 데이터를 불러오는 중...</p>
                <p className="text-xs mt-1 text-slate-300">서버 연동 후 표시됩니다.</p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
