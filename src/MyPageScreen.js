import { useState } from 'react';
import {
  Bell, Moon, Sun, Monitor, RotateCcw,
  AlertTriangle, Zap, VolumeX, MessageSquare, FlaskConical, Laugh,
  LogOut, UserCircle, LogIn, KeyRound, UserX, Eye, EyeOff, ChevronDown, ChevronUp,
  Sparkles, Wallet
} from 'lucide-react';
import Sidebar from './Sidebar';
import { mt } from './memeTexts';

// =========================================================================
// MyPageScreen - 환경설정 페이지
//
// 변경사항:
//   - 마이페이지 → 환경설정으로 명칭 변경
//   - 프로필 카드, 계정관리(비밀번호/로그아웃/탈퇴) 섹션 제거 (Guest 모드)
//   - 데이터 관리 섹션 추가: localStorage 전체 초기화 버튼
//
// props:
//   currentPage          - 현재 페이지 이름
//   onNavigate           - 페이지 이동 함수
//   onResetData          - 전체 데이터 초기화 함수 (App.js에서 전달)
//   unreadCount          - 읽지 않은 알림 수
//   onToggleNotifications - 알림 패널 토글
// =========================================================================
export default function MyPageScreen({
  currentPage,
  onNavigate,
  onResetData,
  onLogout,
  onGoToAuth,
  onDeleteAccount,
  unreadCount = 0,
  onToggleNotifications,
  devTestMode = false,
  onToggleDevTestMode,
  memeMode = false,
  onToggleMemeMode,
  authUser = null,
  onOpenDailySummary,
  onResetDailySummaryShown,
  onResetPortfolio,
}) {
  const isGuest = authUser?.type === 'guest';
  const isUser  = authUser?.type === 'user';

  // 테마 설정 상태 ('light' | 'dark' | 'system')
  const [theme, setTheme] = useState('system');

  // 푸시 알림 각 항목의 on/off 상태
  const [alerts, setAlerts] = useState({
    scream:    true,
    greed:     true,
    marketing: false,
    nightMode: true,
  });

  // 비밀번호 변경 폼 열림 여부
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent]   = useState('');
  const [pwNew,     setPwNew]       = useState('');
  const [pwConfirm, setPwConfirm]   = useState('');
  const [pwShow,    setPwShow]      = useState(false);
  const [pwError,   setPwError]     = useState('');
  const [pwSuccess, setPwSuccess]   = useState(false);

  const handleAlertToggle = (key) => {
    setAlerts(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleReset = () => {
    if (window.confirm('북마크, 알림 내역 등 모든 로컬 데이터를 초기화합니다. 계속하시겠습니까?')) {
      onResetData();
    }
  };

  const handlePasswordChange = (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);

    if (!pwCurrent || !pwNew || !pwConfirm) {
      setPwError('모든 항목을 입력하세요.');
      return;
    }
    if (pwNew.length < 6) {
      setPwError('새 비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    try {
      const users = JSON.parse(localStorage.getItem('antsight_users') || '[]');
      const idx = users.findIndex(u => u.username === authUser.username);
      if (idx === -1 || users[idx].password !== pwCurrent) {
        setPwError('현재 비밀번호가 올바르지 않습니다.');
        return;
      }
      users[idx].password = pwNew;
      localStorage.setItem('antsight_users', JSON.stringify(users));
      setPwSuccess(true);
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
      setTimeout(() => { setPwOpen(false); setPwSuccess(false); }, 1500);
    } catch {
      setPwError('비밀번호 변경 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteAccount = () => {
    if (!window.confirm('정말로 탈퇴하시겠습니까?\n모든 데이터가 삭제되며 되돌릴 수 없습니다.')) return;
    onDeleteAccount();
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">

      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />

      <main className="flex-1 flex flex-col h-screen overflow-y-auto">

        {/* 상단 헤더 */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="text-lg font-bold text-slate-900">환경설정</div>
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

        <div className="p-8 max-w-5xl mx-auto w-full space-y-8 pb-20">

          {/* ── 프로필 카드 ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                isGuest ? 'bg-slate-100' : 'bg-indigo-100'
              }`}>
                <UserCircle className={`w-8 h-8 ${isGuest ? 'text-slate-400' : 'text-indigo-500'}`} />
              </div>
              <div>
                {isGuest ? (
                  <>
                    <div className="font-bold text-slate-900 text-lg">게스트</div>
                    <div className="text-sm text-slate-400 mt-0.5">로그인하면 더 많은 기능을 이용할 수 있습니다.</div>
                  </>
                ) : (
                  <>
                    <div className="font-bold text-slate-900 text-lg">{authUser?.username}</div>
                    <div className="text-sm text-slate-400 mt-0.5">{authUser?.email}</div>
                  </>
                )}
              </div>
            </div>

            {/* 게스트: 로그인 버튼 / 유저: 로그아웃 버튼 */}
            {isGuest ? (
              <button
                onClick={onGoToAuth}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-600 text-sm font-bold hover:bg-indigo-100 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                로그인
              </button>
            ) : (
              <button
                onClick={() => { if (window.confirm('로그아웃 하시겠습니까?')) onLogout(); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-500 text-sm font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                로그아웃
              </button>
            )}
          </div>

          {/* ── 계정 관리 (로그인 유저 전용) ── */}
          {isUser && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <UserCircle className="w-5 h-5 text-indigo-500" />
                  계정 관리
                </h3>
              </div>

              {/* 비밀번호 변경 */}
              <div className="border-b border-slate-100">
                <div
                  className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => { setPwOpen(v => !v); setPwError(''); setPwSuccess(false); }}
                >
                  <div className="flex items-center gap-3">
                    <KeyRound className="w-5 h-5 text-slate-500 flex-shrink-0" />
                    <div>
                      <div className="font-bold text-slate-800">비밀번호 변경</div>
                      <div className="text-sm text-slate-400 mt-0.5">현재 비밀번호를 확인 후 새 비밀번호로 변경합니다.</div>
                    </div>
                  </div>
                  {pwOpen
                    ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  }
                </div>

                {pwOpen && (
                  <form onSubmit={handlePasswordChange} className="px-6 pb-6 space-y-3">
                    <PwInput
                      placeholder="현재 비밀번호"
                      value={pwCurrent}
                      onChange={e => setPwCurrent(e.target.value)}
                      show={pwShow}
                      onToggleShow={() => setPwShow(v => !v)}
                    />
                    <PwInput
                      placeholder="새 비밀번호 (6자 이상)"
                      value={pwNew}
                      onChange={e => setPwNew(e.target.value)}
                      show={pwShow}
                    />
                    <PwInput
                      placeholder="새 비밀번호 확인"
                      value={pwConfirm}
                      onChange={e => setPwConfirm(e.target.value)}
                      show={pwShow}
                    />
                    {pwError && (
                      <p className="text-xs text-red-500 font-medium">{pwError}</p>
                    )}
                    {pwSuccess && (
                      <p className="text-xs text-green-600 font-bold">비밀번호가 변경되었습니다.</p>
                    )}
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-700 transition-colors"
                    >
                      변경 완료
                    </button>
                  </form>
                )}
              </div>

              {/* 회원 탈퇴 */}
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <UserX className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div>
                    <div className="font-bold text-slate-800">회원 탈퇴</div>
                    <div className="text-sm text-slate-400 mt-0.5">계정과 모든 데이터가 영구 삭제됩니다.</div>
                  </div>
                </div>
                <button
                  onClick={handleDeleteAccount}
                  className="flex-shrink-0 flex items-center gap-1.5 bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors"
                >
                  <UserX className="w-4 h-4" />
                  탈퇴
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* ── 화면 설정 (테마) ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-indigo-500" />
                  화면 설정
                </h3>
              </div>
              <div className="p-6">
                <label className="block text-sm font-bold text-slate-700 mb-3">
                  테마 (Dark Mode)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'light',  label: '라이트',     Icon: Sun     },
                    { value: 'dark',   label: '다크',       Icon: Moon    },
                    { value: 'system', label: '시스템 설정', Icon: Monitor },
                  ].map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      onClick={() => setTheme(value)}
                      className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all ${
                        theme === value
                          ? 'border-slate-900 bg-slate-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Icon className={`w-6 h-6 mb-2 ${theme === value ? 'text-slate-900' : 'text-slate-400'}`} />
                      <span className={`text-sm font-bold ${theme === value ? 'text-slate-900' : 'text-slate-500'}`}>
                        {label}
                      </span>
                    </button>
                  ))}
                </div>

                {/* 밈 모드 토글 */}
                <div className="mt-5 pt-5 border-t border-slate-100">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={onToggleMemeMode}
                  >
                    <div className="flex items-start gap-3">
                      <Laugh className={`w-5 h-5 mt-0.5 flex-shrink-0 ${memeMode ? 'text-yellow-500' : 'text-slate-400'}`} />
                      <div>
                        <div className="font-bold text-slate-800 flex items-center gap-2">
                          밈 모드 (Meme Mode)
                          {memeMode && (
                            <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full font-black">
                              ON
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-500 mt-1 leading-relaxed">
                          UI 곳곳의 텍스트가 커뮤니티 밈으로 바뀝니다.<br />
                          언제든 끄면 원래 텍스트로 복구됩니다.
                        </div>
                      </div>
                    </div>
                    <button
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ml-4 ${
                        memeMode ? 'bg-yellow-400' : 'bg-slate-200'
                      }`}
                      role="switch"
                      aria-checked={memeMode}
                      onClick={(e) => { e.stopPropagation(); onToggleMemeMode(); }}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          memeMode ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── 알림 설정 ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-yellow-500" />
                  푸시 알림 설정
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                <ToggleItem
                  icon={<AlertTriangle className="w-5 h-5 text-blue-500" />}
                  title={mt('alert_scream_title', memeMode)}
                  description={mt('alert_scream_desc', memeMode)}
                  checked={alerts.scream}
                  onChange={() => handleAlertToggle('scream')}
                />
                <ToggleItem
                  icon={<Zap className="w-5 h-5 text-red-500" />}
                  title={mt('alert_greed_title', memeMode)}
                  description={mt('alert_greed_desc', memeMode)}
                  checked={alerts.greed}
                  onChange={() => handleAlertToggle('greed')}
                />
                <ToggleItem
                  icon={<VolumeX className="w-5 h-5 text-slate-500" />}
                  title="방해 금지 모드"
                  description="밤 10시부터 아침 8시까지는 모든 푸시 알림을 무음으로 처리합니다."
                  checked={alerts.nightMode}
                  onChange={() => handleAlertToggle('nightMode')}
                />
                <ToggleItem
                  icon={<MessageSquare className="w-5 h-5 text-indigo-500" />}
                  title="이벤트 및 혜택 알림"
                  description="AntSight의 새로운 기능과 이벤트 소식을 받아보세요."
                  checked={alerts.marketing}
                  onChange={() => handleAlertToggle('marketing')}
                />
              </div>
            </div>
          </div>

          {/* ── 개발자 옵션 ── */}
          <div className="bg-amber-50 rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-amber-200 bg-amber-100/50">
              <h3 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-amber-600" />
                개발자 옵션
              </h3>
            </div>
            <div className="divide-y divide-amber-100">
              {/* 테스트 모드 토글 */}
              <div
                className="flex items-center justify-between p-6 hover:bg-amber-100/40 transition-colors cursor-pointer"
                onClick={onToggleDevTestMode}
              >
                <div className="flex items-start gap-4 pr-4">
                  <FlaskConical className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-bold text-amber-900">
                      테스트 모드
                      {devTestMode && (
                        <span className="ml-2 text-xs bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full font-black">
                          ON
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-amber-700 mt-1 leading-relaxed">
                      서버 연동 전 더미 데이터로 UI를 확인합니다.<br />
                      ON 전환 후 <span className="font-bold">3초</span> 뒤에 각 화면에 샘플 데이터가 표시됩니다.
                    </div>
                  </div>
                </div>
                {/* 토글 스위치 — amber 색상 */}
                <button
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    devTestMode ? 'bg-amber-500' : 'bg-amber-200'
                  }`}
                  role="switch"
                  aria-checked={devTestMode}
                  onClick={(e) => { e.stopPropagation(); onToggleDevTestMode(); }}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      devTestMode ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* ── 북마크 일일 요약 ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                북마크 일일 요약
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500 leading-relaxed">
                하루에 한 번, 사이트 첫 진입 시 북마크 종목의 현재가·등락률·개미지수 요약이 자동으로 표시됩니다.
                같은 날 다시 확인하거나 자동 표시 동작을 검증할 때 아래 버튼을 사용하세요.
              </p>
              <div className="flex flex-wrap gap-3">
                {onOpenDailySummary && (
                  <button
                    onClick={onOpenDailySummary}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    지금 요약 다시 보기
                  </button>
                )}
                {onResetDailySummaryShown && (
                  <button
                    onClick={() => {
                      onResetDailySummaryShown();
                      window.alert('자동 표시 기록을 초기화했습니다.\n홈으로 이동하면 요약이 자동으로 다시 표시됩니다.');
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                    title="localStorage의 마지막 표시 날짜를 삭제합니다."
                  >
                    <RotateCcw className="w-4 h-4" />
                    자동 표시 기록 초기화 (테스트)
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── 모의투자 ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-500" />
                모의투자 포트폴리오
              </h3>
            </div>
            <div className="p-6 flex items-start justify-between gap-6 flex-wrap">
              <div>
                <div className="font-bold text-slate-800 mb-1">포트폴리오 초기화</div>
                <div className="text-sm text-slate-500 leading-relaxed">
                  모의투자 보유 종목 / 거래 내역을 모두 삭제하고 초기 시드 자본 (10,000,000원) 으로 되돌립니다.<br />
                  이 작업은 되돌릴 수 없습니다. (북마크·알림은 영향 없음)
                </div>
              </div>
              <button
                onClick={() => {
                  if (window.confirm('모의투자 포트폴리오를 초기화하시겠습니까?\n보유 종목과 거래 내역이 모두 삭제되며 초기 시드(10,000,000원)로 되돌아갑니다.')) {
                    onResetPortfolio?.();
                    window.alert('초기화 완료. 모의투자 탭에서 확인하세요.');
                  }
                }}
                className="flex-shrink-0 flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-amber-100 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                포트폴리오 초기화
              </button>
            </div>
          </div>

          {/* ── 데이터 관리 ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-slate-500" />
                데이터 관리
              </h3>
            </div>
            <div className="p-6">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="font-bold text-slate-800 mb-1">전체 초기화</div>
                  <div className="text-sm text-slate-500 leading-relaxed">
                    북마크, 알림 내역, 최근 검색 기록 등 기기에 저장된 모든 데이터를 삭제합니다.<br />
                    이 작업은 되돌릴 수 없습니다.
                  </div>
                </div>
                {/* 위험 작업이므로 빨간색으로 강조 */}
                <button
                  onClick={handleReset}
                  className="flex-shrink-0 flex items-center gap-2 bg-red-50 text-red-600 border border-red-200 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  초기화
                </button>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

// =========================================================================
// PwInput - 비밀번호 입력 필드 (눈 아이콘 선택)
// =========================================================================
function PwInput({ placeholder, value, onChange, show, onToggleShow }) {
  return (
    <div className="relative flex items-center">
      <input
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all pr-10"
      />
      {onToggleShow && (
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-3 text-slate-400 hover:text-slate-600"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}

// =========================================================================
// ToggleItem - iOS 스타일 토글 스위치 컴포넌트
//
// props:
//   icon        - 항목 아이콘
//   title       - 항목 제목
//   description - 항목 설명
//   checked     - 현재 켜짐(true)/꺼짐(false) 상태
//   onChange    - 토글 클릭 시 실행할 함수
// =========================================================================
function ToggleItem({ icon, title, description, checked, onChange }) {
  return (
    <div
      className="flex items-center justify-between p-6 hover:bg-slate-50 transition-colors cursor-pointer"
      onClick={onChange}
    >
      <div className="flex items-start gap-4 pr-4">
        <div className="mt-0.5 flex-shrink-0">{icon}</div>
        <div>
          <div className="font-bold text-slate-800">{title}</div>
          <div className="text-sm text-slate-500 mt-1 leading-relaxed">{description}</div>
        </div>
      </div>

      {/* 토글 스위치: checked 여부에 따라 색상과 핸들 위치 변경 */}
      <button
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? 'bg-slate-900' : 'bg-slate-200'
        }`}
        role="switch"
        aria-checked={checked}
        onClick={(e) => { e.stopPropagation(); onChange(); }}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
