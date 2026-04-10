import { useState } from 'react';
import {
  Bell, Moon, Sun, Monitor, RotateCcw,
  AlertTriangle, Zap, VolumeX, MessageSquare, FlaskConical
} from 'lucide-react';
import Sidebar from './Sidebar';

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
  unreadCount = 0,
  onToggleNotifications,
  devTestMode = false,
  onToggleDevTestMode,
}) {
  // 테마 설정 상태 ('light' | 'dark' | 'system')
  const [theme, setTheme] = useState('system');

  // 푸시 알림 각 항목의 on/off 상태
  const [alerts, setAlerts] = useState({
    scream:    true,   // 껄무새 주의보 (공포)
    greed:     true,   // 광기 주의보 (탐욕)
    marketing: false,  // 이벤트 및 혜택 알림
    nightMode: true,   // 방해 금지 모드 (야간 알림 차단)
  });

  // 알림 토글: 특정 key의 값을 반전
  const handleAlertToggle = (key) => {
    setAlerts(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 초기화 확인 후 실행
  const handleReset = () => {
    if (window.confirm('북마크, 알림 내역 등 모든 로컬 데이터를 초기화합니다. 계속하시겠습니까?')) {
      onResetData();
    }
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
                  title="껄무새 주의보 (비명 알림)"
                  description="관심 종목의 공포 지수가 절정에 달했을 때 알림을 받습니다."
                  checked={alerts.scream}
                  onChange={() => handleAlertToggle('scream')}
                />
                <ToggleItem
                  icon={<Zap className="w-5 h-5 text-red-500" />}
                  title="광기 주의보 (가즈아 알림)"
                  description="관심 종목의 탐욕 지수가 임계치를 돌파했을 때 알림을 받습니다."
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
