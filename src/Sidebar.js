import {
  Home, Compass,
  Bookmark, Activity, Settings,
  BarChart2, Gamepad2, ShieldCheck, Trophy,
} from 'lucide-react';

// =========================================================================
// NavItem - 사이드바 개별 메뉴 아이템
// =========================================================================
function NavItem({ icon, label, active, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
        active
          ? 'bg-slate-800 text-white font-medium shadow-md'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
      }`}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </div>
  );
}

// =========================================================================
// Sidebar - 공통 사이드바 컴포넌트
//
// 변경사항:
//   - 커뮤니티 피드 탭 제거
//   - "종목 분석" → "시장 분석" (route: 'market-analysis')
//   - 모의투자 → 커밍순 화면 (route: 'mock-invest')
//   - 하단 유저 버튼 → "환경설정" (Settings 아이콘, route: 'settings')
//   - user prop 제거 (Guest 모드)
//
// props:
//   currentPage - 현재 페이지 이름 (활성 메뉴 결정)
//   onNavigate  - 페이지 이동 함수
// =========================================================================
export default function Sidebar({ currentPage, onNavigate }) {
  return (
    <aside className="w-64 bg-slate-900 text-slate-300 hidden md:flex flex-col justify-between flex-shrink-0">
      <div>
        {/* ── 로고 ── */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 cursor-pointer" onClick={() => onNavigate('dashboard')}>
          <Activity className="w-6 h-6 text-red-500 mr-2" />
          <span className="text-xl font-bold text-white tracking-tight">AntSight</span>
        </div>

        {/* ── 네비게이션 메뉴 ── */}
        <nav className="p-4 space-y-1">
          <NavItem
            icon={<Home size={20} />}
            label="홈"
            active={currentPage === 'dashboard'}
            onClick={() => onNavigate('dashboard')}
          />
          <NavItem
            icon={<Compass size={20} />}
            label="탐색"
            active={currentPage === 'explore'}
            onClick={() => onNavigate('explore')}
          />
          <NavItem
            icon={<BarChart2 size={20} />}
            label="시장 분석"
            active={currentPage === 'market-analysis'}
            onClick={() => onNavigate('market-analysis')}
          />
          <NavItem
            icon={<ShieldCheck size={20} />}
            label="개미지수 투자법"
            active={currentPage === 'ant-strategy'}
            onClick={() => onNavigate('ant-strategy')}
          />
          <NavItem
            icon={<Trophy size={20} />}
            label="LLM 전략 비교"
            active={currentPage === 'llm-compare'}
            onClick={() => onNavigate('llm-compare')}
          />
          <NavItem
            icon={<Gamepad2 size={20} />}
            label="모의투자"
            active={currentPage === 'mock-invest'}
            onClick={() => onNavigate('mock-invest')}
          />
          {/* [DEMO HIDE] OX미니게임 — 추후 복구 예정 */}
          {/*
          <NavItem
            icon={<Gamepad size={20} />}
            label="OX미니게임"
            active={currentPage === 'mini-game-OX'}
            onClick={() => onNavigate('mini-game-OX')}
          />
          */}
          <NavItem
            icon={<Bookmark size={20} />}
            label="북마크 (관심종목)"
            active={currentPage === 'bookmark'}
            onClick={() => onNavigate('bookmark')}
          />
        </nav>
      </div>

      {/* ── 하단 환경설정 버튼 (구 마이페이지) ── */}
      <div className="p-4 border-t border-slate-800">
        <div
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
            currentPage === 'settings'
              ? 'bg-slate-800 text-white font-medium shadow-md'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
          onClick={() => onNavigate('settings')}
        >
          <Settings size={20} />
          <span className="text-sm">환경설정</span>
        </div>
      </div>
    </aside>
  );
}
