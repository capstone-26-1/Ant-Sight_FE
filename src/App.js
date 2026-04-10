import { useState, useEffect } from 'react';

import DashBoardScreen       from './DashBoardScreen';
import ExplorePageScreen     from './ExplorePageScreen';
import MarketAnalysisScreen  from './MarketAnalysisScreen';
import BookmarkPageScreen    from './BookmarkPageScreen';
import MockInvestScreen      from './MockInvestScreen';
import MiniGameOXScreen      from './MiniGameOXScreen';
import MyPageScreen          from './MyPageScreen';
import NotificationPanel     from './NotificationPanel';

// 개발용 더미 데이터 (테스트 모드에서만 사용)
import {
  dummyDashboardData,
  dummyAnalysisData,
  dummyExploreData,
} from './dummyData';

// =========================================================================
// App 컴포넌트 - 앱 전체 최상위 컴포넌트
//
// [개발용 테스트 모드]
//   - devTestMode가 true이면 각 화면에 실제 서버 대신 더미 데이터를 제공
//   - 페이지 진입 후 3초 뒤에 데이터가 "도착"하는 것처럼 동작 (로딩 UX 확인용)
//   - 환경설정 탭 하단의 "테스트 모드" 토글로 ON/OFF 가능
//   - 설정은 localStorage('antsight_dev_test_mode')에 저장되어 유지됨
// =========================================================================
export default function App() {

  // ── 현재 페이지 ──────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState('dashboard');

  // ── 탐색 탭에 사전 선택될 종목 ────────────────────────────────────────
  const [exploreInitialStock, setExploreInitialStock] = useState(null);

  // ── 북마크 목록 ───────────────────────────────────────────────────────
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      const saved = localStorage.getItem('antsight_bookmarks');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // ── 알림 목록 ─────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('antsight_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // ── 알림 패널 표시 여부 ───────────────────────────────────────────────
  const [showNotifications, setShowNotifications] = useState(false);

  // ── [개발] 테스트 모드 ON/OFF ─────────────────────────────────────────
  // localStorage에 저장하여 새로고침 후에도 설정 유지
  const [devTestMode, setDevTestMode] = useState(() => {
    return localStorage.getItem('antsight_dev_test_mode') === 'true';
  });

  // ── [개발] 서버 데이터 상태 (null = 로딩 전 / 객체 = 데이터 도착) ─────
  // 실제 서버 연동 시 이 state들을 API 응답으로 채우면 됩니다.
  const [dashboardData,  setDashboardData]  = useState(null);
  const [analysisData,   setAnalysisData]   = useState(null);
  const [exploreData,    setExploreData]    = useState(null);

  // ─────────────────────────────────────────────────────────────────────
  // [개발] 테스트 모드 효과:
  //   - devTestMode가 ON으로 바뀌면 → 3초 후 더미 데이터를 state에 주입
  //   - devTestMode가 OFF로 바뀌면 → 모든 데이터 state를 null로 초기화
  //
  // 실제 서버 연동 시:
  //   이 useEffect를 제거하고, 아래와 같이 API 호출로 대체하면 됩니다:
  //   useEffect(() => {
  //     fetchDashboardData().then(setDashboardData);
  //     fetchAnalysisData().then(setAnalysisData);
  //     fetchExploreData().then(setExploreData);
  //   }, []);
  // ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (devTestMode) {
      // 3초 후 더미 데이터 "도착" 시뮬레이션
      const timer = setTimeout(() => {
        setDashboardData(dummyDashboardData);
        setAnalysisData(dummyAnalysisData);
        setExploreData(dummyExploreData);
      }, 3000);
      // cleanup: 테스트 모드가 꺼지면 타이머 취소
      return () => clearTimeout(timer);
    } else {
      // 테스트 모드 OFF → 모든 데이터 초기화 (로딩 전 상태로 복귀)
      setDashboardData(null);
      setAnalysisData(null);
      setExploreData(null);
    }
  }, [devTestMode]);

  // 테스트 모드 설정 localStorage 동기화
  useEffect(() => {
    localStorage.setItem('antsight_dev_test_mode', String(devTestMode));
  }, [devTestMode]);

  // bookmarks / notifications localStorage 동기화
  useEffect(() => {
    localStorage.setItem('antsight_bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem('antsight_notifications', JSON.stringify(notifications));
  }, [notifications]);


  // ── navigate 함수 ────────────────────────────────────────────────────
  const navigate = (page, stockData = null) => {
    setCurrentPage(page);
    if (page === 'explore') {
      setExploreInitialStock(stockData);
    }
    setShowNotifications(false);
    window.scrollTo(0, 0);
  };

  // ── 알림 추가 ────────────────────────────────────────────────────────
  const addNotification = (notif) => {
    setNotifications(prev => [
      { id: Date.now(), read: false, ...notif },
      ...prev,
    ]);
  };

  // ── 북마크 토글 ──────────────────────────────────────────────────────
  const toggleBookmark = (stock) => {
    setBookmarks(prev => {
      const isBookmarked = prev.some(b => b.ticker === stock.ticker);
      if (isBookmarked) {
        return prev.filter(b => b.ticker !== stock.ticker);
      } else {
        addNotification({
          type: 'bookmark',
          title: stock.name,
          message: '관심 종목에 추가되었습니다. 여론 변화를 모니터링합니다.',
          time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          stockData: stock,
        });
        return [...prev, { ...stock, alertOn: true }];
      }
    });
  };

  // ── 알림 처리 ────────────────────────────────────────────────────────
  const markNotificationRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };
  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };
  const clearAllNotifications = () => setNotifications([]);

  // ── 전체 데이터 초기화 ────────────────────────────────────────────────
  const resetAllData = () => {
    setBookmarks([]);
    setNotifications([]);
    localStorage.removeItem('antsight_bookmarks');
    localStorage.removeItem('antsight_notifications');
    localStorage.removeItem('antsight_searches');
  };

  // ── 읽지 않은 알림 수 ────────────────────────────────────────────────
  const unreadCount = notifications.filter(n => !n.read).length;

  // ── 공통 props ───────────────────────────────────────────────────────
  const commonProps = {
    currentPage,
    onNavigate: navigate,
    bookmarks,
    unreadCount,
    onToggleNotifications: () => setShowNotifications(v => !v),
  };

  // ── 페이지 렌더링 ────────────────────────────────────────────────────
  const renderPage = () => {
    switch (currentPage) {

      case 'dashboard':
        return (
          <DashBoardScreen
            {...commonProps}
            dashboardData={dashboardData}
          />
        );

      case 'explore':
        return (
          <ExplorePageScreen
            {...commonProps}
            exploreData={exploreData}
            initialStock={exploreInitialStock}
            onToggleBookmark={toggleBookmark}
          />
        );

      case 'market-analysis':
        return (
          <MarketAnalysisScreen
            {...commonProps}
            analysisData={analysisData}
          />
        );

      case 'bookmark':
        return (
          <BookmarkPageScreen
            {...commonProps}
            onToggleBookmark={toggleBookmark}
          />
        );

      case 'mock-invest':
        return <MockInvestScreen {...commonProps} />;

      case 'mini-game-OX':
        return <MiniGameOXScreen {...commonProps} />;

      case 'settings':
        return (
          <MyPageScreen
            {...commonProps}
            onResetData={resetAllData}
            devTestMode={devTestMode}
            onToggleDevTestMode={() => setDevTestMode(v => !v)}
          />
        );

      default:
        return <DashBoardScreen {...commonProps} dashboardData={dashboardData} />;
    }
  };

  return (
    <div>
      {renderPage()}

      {/* [개발] 테스트 모드 활성화 시 우하단에 배지 표시 */}
      {devTestMode && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-amber-400 text-amber-900 text-xs font-black px-3 py-1.5 rounded-full shadow-lg border border-amber-500 pointer-events-none select-none">
          <span className="w-2 h-2 rounded-full bg-amber-700 animate-pulse" />
          DEV TEST MODE
        </div>
      )}

      {/* 알림 패널 */}
      {showNotifications && (
        <NotificationPanel
          notifications={notifications}
          onMarkRead={markNotificationRead}
          onMarkAllRead={markAllRead}
          onClearAll={clearAllNotifications}
          onNavigateToStock={(stock) => {
            navigate('explore', stock);
            setShowNotifications(false);
          }}
          onClose={() => setShowNotifications(false)}
        />
      )}
    </div>
  );
}
