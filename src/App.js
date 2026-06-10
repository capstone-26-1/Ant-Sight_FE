import { useState, useEffect } from 'react';
import { LogIn, UserPlus, Lock } from 'lucide-react';
import { authApi } from './api/auth';
import { bookmarkApi } from './api/bookmarks';

import DashBoardScreen       from './DashBoardScreen';
import ExplorePageScreen     from './ExplorePageScreen';
import MarketAnalysisScreen  from './MarketAnalysisScreen';
import AntStrategyScreen     from './AntStrategyScreen';
import LlmCompareScreen      from './LlmCompareScreen';
import BookmarkPageScreen    from './BookmarkPageScreen';
import MockInvestScreen      from './MockInvestScreen';
// [DEMO HIDE] OX 탭은 추후 복구 예정 — 임포트는 유지
// eslint-disable-next-line no-unused-vars
import MiniGameOXScreen      from './MiniGameOXScreen';
import MyPageScreen          from './MyPageScreen';
import NotificationPanel     from './NotificationPanel';
import AuthScreen            from './AuthScreen';
import DailySummaryModal     from './DailySummaryModal';
import {
  loadPortfolio, savePortfolio, resetPortfolio,
  executeBuy, executeSell, emptyPortfolio,
} from './mockInvest/portfolio';
import { isMarketOpen } from './marketHours';

// 개발용 더미 데이터 (테스트 모드에서만 사용)
import {
  dummyDashboardData,
  dummyAnalysisData,
  dummyExploreData,
} from './dummyData';

// 하루 1회 북마크 요약 자동 표시용 localStorage 키. 값 = "YYYY-MM-DD" (KST 기준).
const DAILY_SUMMARY_LAST_SHOWN_KEY = 'antsight_daily_summary_last_shown';
const todayKstDateString = () => {
  // 사용자 로컬 TZ와 무관하게 KST 기준 날짜를 얻기 위해 en-CA(YYYY-MM-DD) + Asia/Seoul 사용.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
};

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

  // ── 인증 상태 ─────────────────────────────────────────────────────────
  // null       = 미인증(AuthScreen 표시)
  // 'checking' = 토큰 검증 중 (스플래시 표시)
  // { type: 'guest' } | { type: 'user', username, email } = 인증됨
  const [authUser, setAuthUser] = useState(() => {
    // 게스트 세션이 저장되어 있으면 복원
    try {
      const saved = localStorage.getItem('antsight_auth_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.type === 'guest') return parsed;
      }
    } catch { /* 무시 */ }
    // 토큰이 있으면 'checking' — useEffect에서 me() 검증
    return localStorage.getItem('antsight_token') ? 'checking' : null;
  });

  // ── 현재 페이지 ──────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState('dashboard');

  // ── 탐색 탭에 사전 선택될 종목 ────────────────────────────────────────
  const [exploreInitialStock, setExploreInitialStock] = useState(null);

  // ── 북마크 목록 ───────────────────────────────────────────────────────
  // 초기값: localStorage 캐시 (오프라인 fallback용)
  // 로그인 사용자는 useEffect에서 서버 데이터로 덮어씀
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

  // ── 밈 모드 ON/OFF ────────────────────────────────────────────────────
  const [memeMode, setMemeMode] = useState(() => {
    return localStorage.getItem('antsight_meme_mode') === 'true';
  });

  // ── 데이터 병합 모달 ──────────────────────────────────────────────────
  // 게스트 → 로그인 전환 시 기존 데이터 병합 여부 확인
  const [pendingLoginUser, setPendingLoginUser] = useState(null);

  // ── [개발] 테스트 모드 ON/OFF ─────────────────────────────────────────
  // localStorage에 저장하여 새로고침 후에도 설정 유지
  const [devTestMode, setDevTestMode] = useState(() => {
    return localStorage.getItem('antsight_dev_test_mode') === 'true';
  });

  // ── [개발] 서버 데이터 상태 (null = 로딩 전 / 객체 = 데이터 도착) ─────
  // 실제 서버 연동 시 이 state들을 API 응답으로 채우면 됩니다.
  const [dashboardData,  setDashboardData]  = useState(null);
  // analysisData: 시장분석 탭 데모 후 복구용 — 현재는 사용되지 않음
  // eslint-disable-next-line no-unused-vars
  const [analysisData,   setAnalysisData]   = useState(null);
  const [exploreData,    setExploreData]    = useState(null);

  // ─────────────────────────────────────────────────────────────────────
  // [개발] 테스트 모드 효과:
  //   - devTestMode가 ON으로 바뀌면 → 3초 후 더미 데이터를 state에 주입.
  //     단, 이미 서버에서 받아온 실데이터가 들어와 있다면 그 값을 유지(요구사항 #2).
  //   - devTestMode가 OFF로 바뀌면 → 모든 데이터 state를 null로 초기화
  //
  // 실제 서버 연동 시:
  //   이 useEffect는 그대로 두고, 별도 useEffect에서 API 호출로 set*Data를
  //   채워주면 됩니다 — 이 effect의 prev ?? dummy 패턴이 서버값을 우선합니다.
  // ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (devTestMode) {
      // 3초 후 더미 데이터 "도착" 시뮬레이션 — 서버 값이 이미 있으면 더미로 덮지 않음
      const timer = setTimeout(() => {
        setDashboardData(prev => prev ?? dummyDashboardData);
        setAnalysisData(prev => prev ?? dummyAnalysisData);
        setExploreData(prev => prev ?? dummyExploreData);
      }, 3000);
      // cleanup: 테스트 모드가 꺼지면 타이머 취소
      return () => clearTimeout(timer);
    } else {
      // 테스트 모드 OFF → 더미 잔재 제거. 서버 데이터(있다면)는 별도 effect에서
      // 다시 채워주는 책임이 있으므로 여기서는 null로 초기화.
      setDashboardData(null);
      setAnalysisData(null);
      setExploreData(null);
    }
  }, [devTestMode]);

  // ── 토큰 검증 (앱 최초 로드 시 한 번) ───────────────────────────────
  useEffect(() => {
    if (authUser !== 'checking') return;
    authApi.me()
      .then(res => {
        setAuthUser({
          type: 'user',
          username: res.nickname,
          email: res.email,
          userId: res.userId,
          role: res.role,
        });
      })
      .catch(() => {
        localStorage.removeItem('antsight_token');
        setAuthUser(null);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 401 인터셉터: 토큰 만료 시 로그아웃 ─────────────────────────────
  useEffect(() => {
    const onExpired = () => {
      setAuthUser(null);
      setCurrentPage('dashboard');
      setBookmarks([]);
      setNotifications([]);
      setShowNotifications(false);
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  // ── 로그인 사용자 북마크 서버 동기화 ────────────────────────────────
  // 서버 응답: [{ bookmarkId, bookmarkedAt, ticker, name, market, sector, marketCapRank }]
  //
  // 주의: 서버 list로 그대로 덮어쓰면 BE 마스터에 없는 종목(예: 한화에어로 012450
  // 등 신규/누락 종목)이 localOnly로 저장되어 있어도 새로고침 시 사라지는 버그가
  // 발생함(요구사항 #3). 그래서 기존 state의 localOnly 항목은 서버 list와 병합한다.
  useEffect(() => {
    if (authUser?.type !== 'user') return;
    bookmarkApi.list()
      .then(list => {
        const mapped = (list || []).map(b => ({
          ticker: b.ticker,
          name: b.name,
          market: b.market,
          sector: b.sector,
          marketCapRank: b.marketCapRank,
          bookmarkId: b.bookmarkId,
          bookmarkedAt: b.bookmarkedAt,
          alertOn: true,
        }));
        setBookmarks(prev => {
          const serverTickers = new Set(mapped.map(b => b.ticker));
          // 서버에 없는 localOnly 항목만 보존 (서버에 있는 동일 ticker는 서버 데이터로 갱신)
          const localOnly = (prev || []).filter(b => b.localOnly && !serverTickers.has(b.ticker));
          const merged = [...mapped, ...localOnly];
          localStorage.setItem('antsight_bookmarks', JSON.stringify(merged));
          return merged;
        });
      })
      .catch(() => { /* 실패 시 캐시 유지 */ });
  }, [authUser]);

  // 게스트 세션 localStorage 동기화 (게스트만)
  useEffect(() => {
    if (authUser?.type === 'guest') {
      localStorage.setItem('antsight_auth_user', JSON.stringify(authUser));
    } else {
      localStorage.removeItem('antsight_auth_user');
    }
  }, [authUser]);

  // 밈 모드 localStorage 동기화
  useEffect(() => {
    localStorage.setItem('antsight_meme_mode', String(memeMode));
  }, [memeMode]);

  // 테스트 모드 설정 localStorage 동기화
  useEffect(() => {
    localStorage.setItem('antsight_dev_test_mode', String(devTestMode));
  }, [devTestMode]);

  // 북마크 캐시 동기화
  //   - 게스트: 모든 변경 사항 localStorage 반영
  //   - 로그인: localOnly 항목이 추가되었을 때 캐시에 함께 저장해야 새로고침 후
  //     로컬→서버 머지 effect에서 보존 가능. 서버 정상 동기화 시는 그 effect 내에서
  //     덮어씌우므로 안전하다.
  useEffect(() => {
    if (authUser?.type === 'guest' || authUser?.type === 'user') {
      localStorage.setItem('antsight_bookmarks', JSON.stringify(bookmarks));
    }
  }, [bookmarks, authUser]);

  useEffect(() => {
    localStorage.setItem('antsight_notifications', JSON.stringify(notifications));
  }, [notifications]);

  // ── 모의투자 포트폴리오 ──────────────────────────────────────────────
  // 사용자별 localStorage 분리 (authUser.userId 또는 'guest').
  // 시장가 매수/매도만 지원. 수수료 0.015% + 매도세 0.20% (LLM 백테스트와 동일).
  const [portfolio, setPortfolio] = useState(emptyPortfolio);

  // authUser 가 확정되면 해당 사용자 포트폴리오 로드. 로그아웃 시 빈 상태로.
  useEffect(() => {
    if (!authUser || authUser === 'checking') {
      setPortfolio(emptyPortfolio());
      return;
    }
    setPortfolio(loadPortfolio(authUser));
  }, [authUser]);

  // portfolio 변경 시 localStorage 동기화 (디바운스 없음 — 거래 빈도 낮음)
  useEffect(() => {
    if (!authUser || authUser === 'checking') return;
    savePortfolio(authUser, portfolio);
  }, [portfolio, authUser]);

  // 거래 실행 핸들러 — { ticker, name, type: 'BUY'|'SELL', quantity, price } → { ok, error?, txn? }
  const executeOrder = ({ ticker, name, type, quantity, price }) => {
    const afterHours = !isMarketOpen();
    const result = type === 'BUY'
      ? executeBuy(portfolio, { ticker, name, quantity, price, afterHours })
      : executeSell(portfolio, { ticker, quantity, price, afterHours });
    if (!result.ok) return result;
    setPortfolio(result.portfolio);
    // 거래 알림 (선택 — 사용자가 알림 패널에서 거래 내역 빠른 확인 가능)
    addNotification({
      type: 'info',
      title: `${result.txn.type === 'BUY' ? '매수' : '매도'} 체결: ${result.txn.name}`,
      message: `${result.txn.quantity.toLocaleString()}주 × ${Math.round(result.txn.price).toLocaleString()}원${afterHours ? ' (장마감가)' : ''}`,
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      stockData: { ticker, name },
    });
    return result;
  };

  const resetPortfolioToSeed = () => {
    if (!authUser || authUser === 'checking') return;
    setPortfolio(resetPortfolio(authUser));
  };

  // ── 북마크 일일 요약 모달 ────────────────────────────────────────────
  // 로그인 사용자가 오늘 아직 모달을 본 적이 없고 북마크가 있으면 자동 표시.
  // 닫으면 오늘 날짜를 localStorage에 기록 — 같은 날 자동으로 다시 안 뜸.
  // 수동 재오픈은 DashBoard "오늘의 요약" 버튼, 테스트는 환경설정의 초기화 버튼.
  const [showDailySummary, setShowDailySummary] = useState(false);
  const [dailySummaryAutoChecked, setDailySummaryAutoChecked] = useState(false);

  useEffect(() => {
    if (dailySummaryAutoChecked) return;
    if (authUser?.type !== 'user') return;
    if (bookmarks.length === 0) return;
    const last = localStorage.getItem(DAILY_SUMMARY_LAST_SHOWN_KEY);
    if (last !== todayKstDateString()) {
      setShowDailySummary(true);
    }
    setDailySummaryAutoChecked(true);
  }, [authUser, bookmarks, dailySummaryAutoChecked]);

  // 로그아웃 시 다음 로그인에서도 자동 체크가 다시 이뤄지도록 플래그 리셋
  useEffect(() => {
    if (!authUser) setDailySummaryAutoChecked(false);
  }, [authUser]);

  const handleCloseDailySummary = () => {
    localStorage.setItem(DAILY_SUMMARY_LAST_SHOWN_KEY, todayKstDateString());
    setShowDailySummary(false);
  };
  const handleOpenDailySummary = () => setShowDailySummary(true);
  const handleResetDailySummaryShown = () => {
    localStorage.removeItem(DAILY_SUMMARY_LAST_SHOWN_KEY);
    setDailySummaryAutoChecked(false);
  };


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
  const toggleBookmark = async (stock) => {
    const isBookmarked = bookmarks.some(b => b.ticker === stock.ticker);

    // 낙관적 UI 업데이트
    if (isBookmarked) {
      setBookmarks(prev => prev.filter(b => b.ticker !== stock.ticker));
    } else {
      addNotification({
        type: 'bookmark',
        title: stock.name,
        message: '관심 종목에 추가되었습니다. 여론 변화를 모니터링합니다.',
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        stockData: stock,
      });
      setBookmarks(prev => [...prev, { ...stock, alertOn: true }]);
    }

    // 로그인 사용자만 서버 동기화 (게스트는 로컬만)
    if (authUser?.type === 'user') {
      try {
        if (isBookmarked) {
          await bookmarkApi.remove(stock.ticker);
        } else {
          await bookmarkApi.add(stock.ticker);
        }
      } catch (err) {
        // 401은 client.js에서 전역 처리. 그 외(특히 BE에 ticker가 없을 때 발생하는 400/404 등):
        //   - 추가 실패: 로컬에는 'localOnly' 플래그로 유지 → 사용자가 선택을 잃지 않음
        //   - 삭제 실패: 롤백
        if (err.status === 401) return;
        if (isBookmarked) {
          // 삭제가 실패한 경우 다시 추가 (롤백)
          setBookmarks(prev => [...prev, { ...stock, alertOn: true }]);
          addNotification({
            type: 'bookmark',
            title: '북마크 삭제 실패',
            message: `${stock.name} 삭제 중 오류가 발생했습니다. (${err.message ?? '알 수 없는 오류'})`,
            time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          });
        } else {
          // 추가가 실패한 경우 — 서버에는 없지만 로컬 유지 (localOnly)
          setBookmarks(prev =>
            prev.map(b => b.ticker === stock.ticker ? { ...b, localOnly: true } : b)
          );
          addNotification({
            type: 'bookmark',
            title: '서버 저장 실패',
            message: `${stock.name}(${stock.ticker}) 서버 등록 실패: ${err.message ?? '알 수 없는 오류'}. 로컬에만 저장됩니다.`,
            time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          });
        }
      }
    }
  };

  // ── 알림 처리 ────────────────────────────────────────────────────────
  const markNotificationRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };
  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };
  const clearAllNotifications = () => setNotifications([]);

  // ── 로그아웃 ─────────────────────────────────────────────────────────
  const handleLogout = () => {
    localStorage.removeItem('antsight_token');
    setAuthUser(null);
    setCurrentPage('dashboard');
    setBookmarks([]);
    setNotifications([]);
    setShowNotifications(false);
  };

  // ── 게스트 → 로그인 화면 이동 (데이터 유지) ──────────────────────────
  // 북마크/알림을 지우지 않고 AuthScreen으로 이동만 함
  const handleGoToAuth = () => {
    setAuthUser(null);
    setCurrentPage('dashboard');
    setShowNotifications(false);
  };

  // ── 로그인 처리 (게스트 데이터 병합 여부 확인) ────────────────────────
  const handleLogin = (user) => {
    const hasGuestData = bookmarks.length > 0 || notifications.length > 0;
    if (hasGuestData) {
      setPendingLoginUser(user);
    } else {
      setAuthUser(user);
    }
  };

  // ── 데이터 병합 후 로그인 ────────────────────────────────────────────
  const handleMergeAndLogin = (merge) => {
    if (!merge) {
      setBookmarks([]);
      setNotifications([]);
    }
    setAuthUser(pendingLoginUser);
    setPendingLoginUser(null);
    // 게스트 시절 로컬 데이터 항목 정리
    localStorage.removeItem('antsight_searches');
  };

  // ── 회원 탈퇴 ─────────────────────────────────────────────────────────
  const handleDeleteAccount = () => {
    handleLogout();
  };

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
    memeMode,
    authUser,
    portfolio,
    onExecuteOrder: executeOrder,
  };

  // ── 페이지 렌더링 ────────────────────────────────────────────────────
  const renderPage = () => {
    switch (currentPage) {

      case 'dashboard':
        return (
          <DashBoardScreen
            {...commonProps}
            dashboardData={dashboardData}
            onOpenDailySummary={handleOpenDailySummary}
          />
        );

      case 'explore':
        return (
          <ExplorePageScreen
            {...commonProps}
            exploreData={exploreData}
            initialStock={exploreInitialStock}
            onToggleBookmark={toggleBookmark}
            onGoToAuth={handleGoToAuth}
          />
        );

      case 'market-analysis':
        return (
          <MarketAnalysisScreen
            {...commonProps}
            onSelectStock={(stock) => navigate('explore', stock)}
          />
        );

      case 'ant-strategy':
        return <AntStrategyScreen {...commonProps} />;

      case 'llm-compare':
        return <LlmCompareScreen {...commonProps} />;

      case 'mock-invest':
        return <MockInvestScreen {...commonProps} />;

      // [DEMO HIDE] OX미니게임 — 추후 복구. 사이드바에서도 숨김.
      case 'mini-game-OX':
        return <DashBoardScreen {...commonProps} dashboardData={dashboardData} />;

      case 'bookmark':
        return (
          <BookmarkPageScreen
            {...commonProps}
            onToggleBookmark={toggleBookmark}
          />
        );

      case 'settings':
        return (
          <MyPageScreen
            {...commonProps}
            onResetData={resetAllData}
            onLogout={handleLogout}
            onGoToAuth={handleGoToAuth}
            onDeleteAccount={handleDeleteAccount}
            devTestMode={devTestMode}
            onToggleDevTestMode={() => setDevTestMode(v => !v)}
            onToggleMemeMode={() => setMemeMode(v => !v)}
            onOpenDailySummary={handleOpenDailySummary}
            onResetDailySummaryShown={handleResetDailySummaryShown}
            onResetPortfolio={resetPortfolioToSeed}
          />
        );

      default:
        return <DashBoardScreen {...commonProps} dashboardData={dashboardData} onOpenDailySummary={handleOpenDailySummary} />;
    }
  };

  // ── 토큰 검증 중 → 스플래시 ─────────────────────────────────────────
  if (authUser === 'checking') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-medium">로그인 정보 확인 중...</p>
        </div>
      </div>
    );
  }

  // ── 미인증 → AuthScreen ──────────────────────────────────────────────
  if (!authUser && !pendingLoginUser) {
    return (
      <AuthScreen
        onLogin={handleLogin}
        onGuest={() => setAuthUser({ type: 'guest' })}
      />
    );
  }

  // ── 데이터 병합 확인 모달 ────────────────────────────────────────────
  if (pendingLoginUser) {
    return (
      <MergeDataModal
        user={pendingLoginUser}
        bookmarkCount={bookmarks.length}
        notificationCount={notifications.length}
        onMerge={() => handleMergeAndLogin(true)}
        onSkip={() => handleMergeAndLogin(false)}
      />
    );
  }

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

      {/* 북마크 일일 요약 모달 — 자동/수동 트리거 공용 */}
      {showDailySummary && (
        <DailySummaryModal
          bookmarks={bookmarks}
          onClose={handleCloseDailySummary}
          onNavigateToStock={(stock) => navigate('explore', stock)}
        />
      )}
    </div>
  );
}

// =========================================================================
// GuestGate - 게스트 접근 제한 화면 (시장분석 / 모의투자)
// 데모 후 시장분석/모의투자 탭 복구 시 재사용.
// =========================================================================
// eslint-disable-next-line no-unused-vars
function GuestGate({ currentPage, onNavigate, onGoToAuth }) {
  const pageLabel = currentPage === 'market-analysis' ? '시장 분석' : '모의투자';

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <div className="w-16 flex-shrink-0 bg-white border-r border-slate-200" />
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-50 border-2 border-indigo-100 rounded-3xl mb-6">
            <Lock className="w-9 h-9 text-indigo-400" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mb-2">{pageLabel} 기능</h2>
          <p className="text-slate-500 mb-2 leading-relaxed">
            이 기능은 로그인한 회원만 이용할 수 있습니다.
          </p>
          <p className="text-slate-400 text-sm mb-8">
            무료로 가입하고 {pageLabel}, 북마크, 알림 등 모든 기능을 사용해보세요.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={onGoToAuth}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-200"
            >
              <LogIn className="w-5 h-5" />
              로그인 / 회원가입
            </button>
            <button
              onClick={() => onNavigate('dashboard')}
              className="w-full py-3 text-slate-500 font-medium hover:text-slate-800 transition-colors text-sm"
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

// =========================================================================
// MergeDataModal - 게스트 세션 데이터 병합 확인 모달
// =========================================================================
function MergeDataModal({ user, bookmarkCount, notificationCount, onMerge, onSkip }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-4">
            <UserPlus className="w-8 h-8 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900">
            {user.username}님, 환영합니다!
          </h2>
          <p className="text-slate-500 mt-2 text-sm leading-relaxed">
            게스트 세션 중 저장한 데이터가 있습니다.<br />
            계정에 유지하시겠습니까?
          </p>
        </div>

        {/* 게스트 데이터 요약 */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 mb-6 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600 font-medium">북마크</span>
            <span className="font-bold text-slate-900">{bookmarkCount}개</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600 font-medium">알림 내역</span>
            <span className="font-bold text-slate-900">{notificationCount}개</span>
          </div>
          <div className="pt-2 border-t border-slate-200 text-xs text-slate-400 leading-relaxed">
            유지 시 북마크·알림이 계정에 추가됩니다.<br />
            기존 데이터는 삭제되지 않습니다.
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={onMerge}
            className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-500 transition-colors"
          >
            데이터 유지하고 로그인
          </button>
          <button
            onClick={onSkip}
            className="w-full py-3 text-slate-500 font-medium hover:text-slate-800 transition-colors text-sm"
          >
            데이터 삭제하고 로그인
          </button>
        </div>
      </div>
    </div>
  );
}
