import { useState, useEffect } from 'react';
import {
  Bell, Search, Activity, Clock, X, Flame, Bookmark,
  TrendingDown, TrendingUp, BrainCircuit, AlertTriangle,
  Minus, Plus, ShoppingCart, ChevronRight
} from 'lucide-react';
import Sidebar from './Sidebar';

// =========================================================================
// ExplorePageScreen - 탐색 페이지
//
// 변경사항:
//   - 종목 클릭 시 탭 이동 없이 오른쪽 패널에 인라인으로 종목 상세 표시
//   - initialStock prop: 홈 등 다른 페이지에서 종목을 클릭하면 해당 종목 선택된 상태로 시작
//   - onToggleBookmark: 종목 상세 패널의 ★ 버튼 연결
//   - 최근 검색어 localStorage 저장
//   - user prop 제거 (Guest 모드)
//
// props:
//   currentPage          - 현재 페이지
//   onNavigate           - 페이지 이동 함수
//   bookmarks            - 북마크 목록
//   onToggleBookmark     - 북마크 추가/제거 함수
//   unreadCount          - 읽지 않은 알림 수
//   onToggleNotifications - 알림 패널 토글
//   exploreData          - 서버 데이터 (null = 로딩 전)
//   initialStock         - 처음부터 선택할 종목 (홈에서 클릭 시)
// =========================================================================
export default function ExplorePageScreen({
  currentPage,
  onNavigate,
  bookmarks = [],
  onToggleBookmark,
  unreadCount = 0,
  onToggleNotifications,
  exploreData = null,
  initialStock = null,
}) {
  // 검색어 입력값
  const [searchQuery, setSearchQuery] = useState('');

  // 최근 검색어 (localStorage 저장)
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('antsight_searches') || '[]');
    } catch {
      return [];
    }
  });

  // 현재 선택된 종목 (null이면 전체 검색 화면, 있으면 우측 패널에 상세 표시)
  const [selectedStock, setSelectedStock] = useState(null);

  // 종목 상세 패널 - 매매 관련 로컬 상태
  const [tradeType, setTradeType]   = useState('BUY');
  const [quantity, setQuantity]     = useState(1);
  const [isAlertOn, setIsAlertOn]   = useState(false);
  const [chartPeriod, setChartPeriod] = useState('1주');

  // ── initialStock 연동 ─────────────────────────────────────────────────
  // App.js에서 navigate('explore', stock)을 호출하면 initialStock이 바뀜.
  // useEffect로 감지해서 selectedStock을 업데이트합니다.
  useEffect(() => {
    setSelectedStock(initialStock || null);
    // 새 종목이 선택될 때 매매 상태 초기화
    if (initialStock) {
      setQuantity(1);
      setTradeType('BUY');
      setIsAlertOn(false);
    }
  }, [initialStock]);

  // 최근 검색어 localStorage 저장
  useEffect(() => {
    localStorage.setItem('antsight_searches', JSON.stringify(recentSearches));
  }, [recentSearches]);

  // 서버 데이터 추출
  const trendingSearches = exploreData?.trendingSearches ?? [];
  const antIndexRankings = exploreData?.antIndexRankings ?? [];

  // 현재 선택 종목이 북마크되어 있는지 확인
  const isBookmarked = selectedStock
    ? bookmarks.some(b => b.ticker === selectedStock.ticker)
    : false;

  // ── 종목 선택 처리 ───────────────────────────────────────────────────
  const handleSelectStock = (stock) => {
    setSelectedStock(stock);
    setQuantity(1);
    setTradeType('BUY');
    setIsAlertOn(false);
  };

  // ── 검색어 처리 ──────────────────────────────────────────────────────
  const handleSelectKeyword = (keyword) => {
    setSearchQuery(keyword);
    setRecentSearches(prev => {
      const filtered = prev.filter(item => item !== keyword);
      return [keyword, ...filtered].slice(0, 5);
    });
  };

  const removeRecentSearch = (item) => {
    setRecentSearches(prev => prev.filter(r => r !== item));
  };

  // ── 종목 상세 계산값 ─────────────────────────────────────────────────
  const price = selectedStock?.price ?? null;
  const totalOrderAmount = price != null ? price * quantity : null;

  const getAntLabel = (idx) => {
    if (idx == null) return '지수 데이터 없음';
    if (idx <= -80)  return '비명 5단계: 투매 절정';
    if (idx <= -50)  return '비명: 공포 확산';
    if (idx <   0)   return '중립: 관망 분위기';
    if (idx <=  50)  return '탐욕: 매수 심리 확산';
    return '광기: 과열 경보';
  };

  // ========================================================================
  // 레이아웃: selectedStock 여부에 따라 두 가지 레이아웃 렌더링
  // ========================================================================
  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">

      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />

      <main className="flex-1 flex flex-col overflow-hidden">

        {/* 상단 헤더 */}
        <header className="h-16 border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 bg-slate-50/80 backdrop-blur-md z-10">
          {/* 검색창 */}
          <div className="flex items-center relative" style={{ width: selectedStock ? '100%' : '480px' }}>
            <Search className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  handleSelectKeyword(searchQuery.trim());
                }
              }}
              placeholder="종목명 또는 티커 검색..."
              className="w-full bg-white border border-slate-200 rounded-full py-2.5 pl-11 pr-10 text-sm font-medium focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 outline-none transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {/* 알림 벨 */}
          <button
            className="relative p-2 text-slate-500 hover:bg-slate-200 rounded-full transition-colors ml-4 flex-shrink-0"
            onClick={onToggleNotifications}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full" />
            )}
          </button>
        </header>

        {/* ── 본문: 선택된 종목 없으면 전체 탐색, 있으면 스플릿 레이아웃 ── */}
        {selectedStock ? (
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          // 스플릿 레이아웃: 왼쪽(종목 목록) + 오른쪽(종목 상세)
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          <div className="flex-1 flex overflow-hidden">

            {/* ── 왼쪽 패널: 랭킹 & 북마크 목록 ── */}
            <div className="w-80 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">

              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-500" />
                  실시간 여론 급변 랭킹
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto">
                {antIndexRankings.length > 0 ? (
                  antIndexRankings.map((stock) => (
                    <div
                      key={stock.ticker}
                      className={`flex items-center justify-between px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 transition-colors ${
                        selectedStock?.ticker === stock.ticker ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''
                      }`}
                      onClick={() => handleSelectStock(stock)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-4 text-xs text-center text-slate-400 font-bold">{stock.rank}</span>
                        <div>
                          <div className="font-bold text-sm text-slate-800">{stock.name}</div>
                          <div className="text-xs text-slate-400">{stock.ticker}</div>
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        stock.type === 'fear' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {stock.score > 0 ? `+${stock.score}` : stock.score}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-slate-400 text-sm py-8">
                    랭킹 데이터 로딩 중...
                  </div>
                )}

                {/* 북마크 목록 */}
                {bookmarks.length > 0 && (
                  <>
                    <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                      <h3 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                        <Bookmark className="w-4 h-4 text-yellow-500" />
                        내 관심 종목
                      </h3>
                    </div>
                    {bookmarks.map((item) => (
                      <div
                        key={item.ticker}
                        className={`flex items-center justify-between px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 transition-colors ${
                          selectedStock?.ticker === item.ticker ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''
                        }`}
                        onClick={() => handleSelectStock(item)}
                      >
                        <div>
                          <div className="font-bold text-sm text-slate-800">{item.name}</div>
                          <div className="text-xs text-slate-400">{item.ticker}</div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          (item.score ?? 0) > 50  ? 'bg-red-100 text-red-700' :
                          (item.score ?? 0) < -50 ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {item.score != null ? (item.score > 0 ? `+${item.score}` : item.score) : '--'}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* ── 오른쪽 패널: 종목 상세 ── */}
            <div className="flex-1 overflow-y-auto bg-slate-50">
              <div className="p-6 max-w-4xl mx-auto space-y-5">

                {/* 종목 헤더 카드 */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-2xl font-bold text-slate-900">{selectedStock.name}</h1>
                        <span className="text-slate-400 font-medium">{selectedStock.ticker}</span>
                        {selectedStock.market && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-bold border border-slate-200">
                            {selectedStock.market}
                          </span>
                        )}
                      </div>
                      {/* 현재가 */}
                      <div className={`text-3xl font-extrabold mt-1 flex items-baseline gap-2 ${
                        selectedStock.isDown ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        {price != null ? `${price.toLocaleString()}원` : '--'}
                        {selectedStock.changeAmount != null && (
                          <span className="text-base font-semibold flex items-center">
                            {selectedStock.isDown
                              ? <TrendingDown className="w-4 h-4 mr-1" />
                              : <TrendingUp className="w-4 h-4 mr-1" />}
                            {Math.abs(selectedStock.changeAmount).toLocaleString()} ({selectedStock.change ?? '--'})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 버튼 그룹 */}
                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      {/* 알림 버튼 */}
                      <button
                        onClick={() => setIsAlertOn(!isAlertOn)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium text-sm transition-colors border ${
                          isAlertOn
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Bell className={`w-4 h-4 ${isAlertOn ? 'fill-indigo-700' : ''}`} />
                        <span className="hidden sm:inline">{isAlertOn ? '주의보 켜짐' : '알림'}</span>
                      </button>

                      {/* 북마크 버튼 - App.js의 toggleBookmark 호출 */}
                      <button
                        onClick={() => onToggleBookmark(selectedStock)}
                        className={`p-2 rounded-xl border transition-colors ${
                          isBookmarked
                            ? 'bg-yellow-50 border-yellow-200 text-yellow-500'
                            : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
                        }`}
                        title={isBookmarked ? '북마크 해제' : '북마크 추가'}
                      >
                        <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-yellow-500' : ''}`} />
                      </button>

                      {/* 상세 닫기 (X) */}
                      <button
                        onClick={() => setSelectedStock(null)}
                        className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                        title="닫기"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 1. AI 개미 지수 리포트 */}
                <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 text-white relative overflow-hidden">
                  <div className="absolute -right-8 -top-8 w-24 h-24 bg-blue-500 rounded-full blur-[40px] opacity-20 pointer-events-none" />
                  <div className="flex items-center gap-2 mb-4">
                    <BrainCircuit className="w-5 h-5 text-indigo-400" />
                    <h2 className="font-bold">AI 개미 지수 리포트</h2>
                  </div>

                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 mb-4">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-slate-400 text-xs">현재 개미 지수</span>
                      <span className="text-2xl font-black text-blue-400">
                        {selectedStock.antIndex != null ? selectedStock.antIndex : '--'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full"
                        style={{ width: selectedStock.antIndex != null ? `${(selectedStock.antIndex + 100) / 2}%` : '50%' }}
                      />
                    </div>
                    <p className="text-xs text-blue-300 mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {getAntLabel(selectedStock.antIndex)}
                    </p>
                  </div>

                  {selectedStock.aiReport ? (
                    <p className="text-slate-300 text-xs leading-relaxed">{selectedStock.aiReport.summary}</p>
                  ) : (
                    <p className="text-slate-500 text-xs text-center py-2">AI 리포트 로딩 중...</p>
                  )}
                </div>

                {/* 2. 주가-개미 지수 통합 차트 */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-base font-bold">주가-개미 지수 통합 차트</h2>
                    <div className="flex gap-1.5">
                      {['1일', '1주', '1개월', '3개월', '1년'].map((t) => (
                        <button
                          key={t}
                          onClick={() => setChartPeriod(t)}
                          className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                            chartPeriod === t
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-48 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center">
                    <div className="text-center text-slate-400">
                      <Activity className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm">차트 데이터 로딩 중...</p>
                    </div>
                  </div>
                </div>

                {/* 3. 시장 데이터 (+더보기) */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <h2 className="font-bold text-sm">시장 데이터</h2>
                    <button className="text-xs text-slate-500 flex items-center hover:text-slate-800 transition-colors">
                      더보기 <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <InfoCard label="거래량"        value={selectedStock.volume ?? '--'} />
                    <InfoCard label="MA5"           value={selectedStock.ma5    ?? '--'} />
                    <InfoCard label="MA20"          value={selectedStock.ma20   ?? '--'} />
                    <InfoCard label="52주 최저가"   value={selectedStock.low52  ?? '--'} valueColor="text-blue-600" />
                  </div>
                </div>

                {/* 4. 모의투자 */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <ShoppingCart className="w-5 h-5 text-slate-800" />
                    <h2 className="font-bold">모의투자</h2>
                  </div>

                  {/* 매수/매도 탭 */}
                  <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                    <button
                      onClick={() => setTradeType('BUY')}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-sm transition-all ${
                        tradeType === 'BUY' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'
                      }`}
                    >매수</button>
                    <button
                      onClick={() => setTradeType('SELL')}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-sm transition-all ${
                        tradeType === 'SELL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
                      }`}
                    >매도</button>
                  </div>

                  {/* 현재가 */}
                  <div className="mb-3">
                    <label className="text-xs font-bold text-slate-500 block mb-1">주문 단가 (시장가)</label>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-700 text-right text-sm cursor-not-allowed">
                      {price != null ? `${price.toLocaleString()} 원` : '-- 원'}
                    </div>
                  </div>

                  {/* 수량 */}
                  <div className="mb-3">
                    <label className="text-xs font-bold text-slate-500 block mb-1">주문 수량</label>
                    <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                        className="px-3 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border-r border-slate-300"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                        className="w-full text-center font-bold text-base border-none outline-none bg-white"
                        min="1"
                      />
                      <button
                        onClick={() => setQuantity(q => q + 1)}
                        className="px-3 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border-l border-slate-300"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 총 주문 금액 */}
                  <div className="flex justify-between items-center py-3 border-t border-slate-100 mb-3">
                    <span className="text-sm text-slate-500">총 주문 금액</span>
                    <span className="font-black text-slate-900">
                      {totalOrderAmount != null ? `${totalOrderAmount.toLocaleString()} 원` : '-- 원'}
                    </span>
                  </div>

                  {/* 주문 버튼 */}
                  <button
                    className={`w-full py-3 rounded-xl font-bold text-white text-sm transition-colors ${
                      tradeType === 'BUY'
                        ? 'bg-red-500 hover:bg-red-600'
                        : 'bg-blue-500 hover:bg-blue-600'
                    }`}
                    onClick={() => alert(`[모의투자] ${selectedStock.name} ${quantity}주 ${tradeType === 'BUY' ? '매수' : '매도'}`)}
                  >
                    {tradeType === 'BUY' ? '시장가 매수' : '시장가 매도'}
                  </button>
                  <p className="text-center text-xs text-slate-400 mt-2">
                    * 클릭 시점의 시장 호가로 즉시 체결됩니다.
                  </p>
                </div>

              </div>
            </div>
          </div>

        ) : (
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          // 전체 탐색 화면: 검색 히어로 + 랭킹 + 북마크
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          <div className="flex-1 overflow-y-auto">
            <div className="p-8 max-w-6xl mx-auto w-full">

              {/* 검색 히어로 */}
              <div className="flex flex-col items-center justify-center pt-8 pb-12">
                <h1 className="text-3xl font-extrabold text-slate-900 mb-2">
                  어떤 종목의 여론이 궁금하신가요?
                </h1>
                <p className="text-slate-500 mb-6 text-center">
                  AI가 수만 건의 커뮤니티 게시글을 분석하여 시장의 진짜 분위기를 알려드립니다.
                </p>

                {/* 최근/인기 검색어 */}
                <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-500 flex items-center gap-2 mb-3">
                      <Clock className="w-4 h-4" /> 최근 검색어
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.length > 0 ? (
                        recentSearches.map((item) => (
                          <div key={item} className="flex items-center gap-1 bg-white border border-slate-200 px-3 py-1.5 rounded-full text-sm font-medium text-slate-700 hover:border-slate-400 cursor-pointer transition-colors">
                            <span onClick={() => setSearchQuery(item)}>{item}</span>
                            <X
                              className="w-3 h-3 text-slate-400 hover:text-slate-600 ml-1"
                              onClick={(e) => { e.stopPropagation(); removeRecentSearch(item); }}
                            />
                          </div>
                        ))
                      ) : (
                        <span className="text-sm text-slate-400">최근 검색어가 없습니다.</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-500 flex items-center gap-2 mb-3">
                      <Flame className="w-4 h-4 text-red-500" /> 실시간 인기 검색
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {trendingSearches.length > 0 ? (
                        trendingSearches.map((item) => (
                          <div
                            key={item.keyword}
                            onClick={() => handleSelectKeyword(item.keyword)}
                            className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-full text-sm font-medium text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors"
                          >
                            <span className="text-slate-500 text-xs font-bold">{item.rank}</span>
                            <span>{item.keyword}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-sm text-slate-400">인기 검색어를 불러오는 중...</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 랭킹 & 북마크 2열 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* 여론 급변 랭킹 */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
                    <Activity className="w-5 h-5 text-indigo-500" />
                    실시간 여론 급변 랭킹
                  </h2>
                  <div className="space-y-2">
                    {antIndexRankings.length > 0 ? (
                      antIndexRankings.map((stock) => (
                        <div
                          key={stock.ticker}
                          className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl cursor-pointer group transition-colors"
                          onClick={() => handleSelectStock(stock)}
                        >
                          <div className="flex items-center gap-4">
                            <span className="w-5 text-center font-bold text-slate-400 text-sm">{stock.rank}</span>
                            <div>
                              <h3 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors text-sm">
                                {stock.name}
                              </h3>
                              <span className="text-xs text-slate-500">{stock.ticker}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-500">{stock.trend}</span>
                            <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                              stock.type === 'fear' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {stock.score > 0 ? `+${stock.score}` : stock.score}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center py-8 text-slate-400">
                        <Activity className="w-8 h-8 mb-2 text-slate-300" />
                        <p className="text-sm">랭킹 데이터를 불러오는 중...</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 북마크 현황 */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Bookmark className="w-5 h-5 text-yellow-500" />
                      내 북마크 현황
                    </h2>
                    <button
                      className="text-sm text-slate-500 flex items-center hover:text-slate-800"
                      onClick={() => onNavigate('bookmark')}
                    >
                      관리 <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2">
                    {bookmarks.length > 0 ? (
                      bookmarks.map((item) => (
                        <div
                          key={item.ticker}
                          className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
                          onClick={() => handleSelectStock(item)}
                        >
                          <div>
                            <h3 className="font-bold text-slate-800 text-sm">{item.name}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-sm text-slate-500">
                                {item.price != null ? item.price.toLocaleString() : '--'}
                              </span>
                              <span className={`text-xs font-bold ${
                                String(item.change ?? '').startsWith('+') ? 'text-red-500' : 'text-blue-500'
                              }`}>
                                {item.change ?? '--'}
                              </span>
                            </div>
                          </div>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded ${
                            (item.score ?? 0) > 50  ? 'bg-red-50 text-red-600 border border-red-100' :
                            (item.score ?? 0) < -50 ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                            'bg-slate-50 text-slate-600 border border-slate-200'
                          }`}>
                            {item.score != null ? (item.score > 0 ? `+${item.score}` : item.score) : '--'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center py-8 text-slate-400">
                        <Bookmark className="w-8 h-8 mb-2 text-slate-300" />
                        <p className="text-sm">관심 종목을 추가하면 여기에 표시됩니다.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// 시장 데이터 미니 카드
function InfoCard({ label, value, valueColor = 'text-slate-900' }) {
  return (
    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
      <div className="text-xs font-bold text-slate-500 mb-1">{label}</div>
      <div className={`font-bold text-sm ${valueColor}`}>{value}</div>
    </div>
  );
}
