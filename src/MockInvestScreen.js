import { Gamepad2, Bell, Clock } from 'lucide-react';
import Sidebar from './Sidebar';

// =========================================================================
// MockInvestScreen - 모의투자 탭 (Coming Soon)
//
// 현재는 준비 중 화면을 표시합니다.
// 추후 모의투자 기능이 추가될 예정입니다.
// =========================================================================
export default function MockInvestScreen({
  currentPage,
  onNavigate,
  unreadCount = 0,
  onToggleNotifications,
}) {
  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">

      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />

      <main className="flex-1 flex flex-col h-screen overflow-y-auto">

        {/* 상단 헤더 */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="text-lg font-bold text-slate-900">모의투자</div>
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

        {/* Coming Soon 본문 */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">

            {/* 아이콘 */}
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-200">
              <Gamepad2 className="w-12 h-12 text-slate-400" />
            </div>

            {/* Coming Soon 배지 */}
            <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-1.5 rounded-full border border-indigo-100 mb-4">
              <Clock className="w-3.5 h-3.5" />
              COMING SOON
            </div>

            <h2 className="text-3xl font-extrabold text-slate-900 mb-3">
              추후 찾아뵙겠습니다.
            </h2>
            <p className="text-slate-500 leading-relaxed mb-8">
              실제 시장 데이터를 기반으로 한 모의투자 기능을
              준비하고 있습니다.<br />
              개미지수와 연동된 전략적 모의투자를 경험해 보세요!
            </p>

            {/* 예정 기능 목록 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-left space-y-3 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                예정 기능
              </p>
              {[
                '실시간 시장가 기반 모의 매수/매도',
                '포트폴리오 수익률 트래킹',
                '개미지수 연동 전략 추천',
                '다른 사용자와 수익률 비교 (랭킹)',
              ].map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-indigo-600 text-xs font-bold">{i + 1}</span>
                  </div>
                  <span className="text-sm text-slate-600">{feature}</span>
                </div>
              ))}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
