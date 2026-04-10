import { useState } from 'react';
import {
  Bell, Search, TrendingDown, TrendingUp, Activity,
  BrainCircuit, AlertTriangle, Minus, Plus, ShoppingCart, Bookmark
} from 'lucide-react';
import Sidebar from './Sidebar';

// =========================================================================
// StockDetailPageScreen - 종목 상세 페이지
// (주가-감성 차트, AI 비명지수 리포트, 모의투자 매매창)
//
// props:
//   currentPage      - 현재 페이지 이름
//   onNavigate       - 페이지 이동 함수
//   stock            - 선택된 종목 데이터 (null이면 종목 선택 안내 표시)
//   bookmarks        - 북마크 목록 (북마크 여부 확인에 사용)
//   onToggleBookmark - 북마크 추가/제거 함수 (App.js에서 전달)
//   user             - 사용자 정보
//
// stock 객체 구조 예시 (서버 연동 시):
//   {
//     name: '에코프로',
//     ticker: '086520',
//     market: '코스닥',       // 상장 시장
//     price: 124000,          // 현재가
//     change: '-4.2%',        // 등락률
//     changeAmount: -5400,    // 등락 금액
//     isDown: true,           // 하락 여부
//     volume: '1,245,890',    // 거래량
//     ma5: '131,500',         // 5일 이동평균
//     ma20: '145,200',        // 20일 이동평균
//     low52: '118,000',       // 52주 최저가
//     antIndex: -95,          // 개미 지수 (-100~100)
//     aiReport: {             // AI 분석 리포트
//       summary: '현재 커뮤니티는 ...',
//       prediction: { label: '기술적 반등 (UP)', probability: 78 }
//     }
//   }
// =========================================================================
export default function StockDetailPageScreen({
  currentPage,
  onNavigate,
  stock = null,
  bookmarks = [],
  onToggleBookmark,
  user = null,
}) {
  // 매매 유형: 'BUY'(매수) 또는 'SELL'(매도)
  const [tradeType, setTradeType] = useState('BUY');
  // 주문 수량
  const [quantity, setQuantity] = useState(1);
  // 알림 켜짐/꺼짐 상태
  const [isAlertOn, setIsAlertOn] = useState(false);
  // 선택된 차트 기간
  const [chartPeriod, setChartPeriod] = useState('1주');

  // 이 종목이 북마크되어 있는지 확인
  // some() = 배열에 조건에 맞는 항목이 하나라도 있으면 true
  const isBookmarked = stock
    ? bookmarks.some(b => b.ticker === stock.ticker)
    : false;

  // 사용자 자산 정보 (서버에서 받아올 예정, 현재는 null)
  const myAsset = user?.asset ?? null;

  // ── stock이 null이면 종목 선택 안내 화면 ─────────────────────────────
  if (!stock) {
    return (
      <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
        <Sidebar currentPage={currentPage} onNavigate={onNavigate} user={user} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-400">
            <Activity className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-xl font-bold text-slate-600 mb-2">종목을 선택해 주세요.</p>
            <p className="text-sm mb-6">
              탐색 페이지나 홈의 랭킹에서 종목을 클릭하면<br />상세 정보를 볼 수 있습니다.
            </p>
            <button
              className="bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors"
              onClick={() => onNavigate('explore')}
            >
              탐색 페이지로 이동
            </button>
          </div>
        </main>
      </div>
    );
  }

  // stock 객체에서 값 추출 (없으면 null 또는 '--')
  const price    = stock.price    ?? null;
  const antIndex = stock.antIndex ?? null;

  // 총 주문 금액 계산 (price와 quantity가 있을 때만)
  const totalOrderAmount = price != null ? price * quantity : null;
  // 최대 구매 가능 수량 계산
  const maxQuantity = (myAsset?.cash != null && price != null)
    ? Math.floor(myAsset.cash / price)
    : null;

  // antIndex → 단계 텍스트 변환
  const getAntIndexLabel = (idx) => {
    if (idx == null)  return '데이터 없음';
    if (idx <= -80)   return '비명 5단계: 투매 절정 구간';
    if (idx <= -50)   return '비명: 공포 확산 구간';
    if (idx <   0)    return '중립: 관망 분위기';
    if (idx <=  50)   return '탐욕: 매수 심리 확산';
    return '광기: 과열 경보 구간';
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">

      {/* ── 공통 사이드바 ── */}
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} user={user} />

      {/* ── 메인 콘텐츠 ── */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto">

        {/* 상단 헤더: 검색창 클릭 시 탐색 페이지로 이동 */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <div
            className="flex items-center w-96 relative cursor-pointer"
            onClick={() => onNavigate('explore')}
          >
            <Search className="w-5 h-5 text-slate-400 absolute left-3" />
            <div className="w-full bg-slate-100 rounded-full py-2 pl-10 pr-4 text-sm text-slate-400 select-none">
              종목명 또는 티커 검색...
            </div>
          </div>
          {/* 나중에 서버에서 마지막 업데이트 시간을 받아서 표시 */}
          <div className="text-sm font-medium text-slate-500">
            {stock.lastUpdated ?? '업데이트 시간 --'}
          </div>
        </header>

        <div className="p-6 lg:p-8 max-w-[1600px] mx-auto w-full grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* ── 좌측: 차트 및 종목 정보 (2/3) ── */}
          <div className="xl:col-span-2 space-y-6">

            {/* 종목 타이틀 카드 */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl font-bold text-slate-900">{stock.name}</h1>
                  <span className="text-lg font-medium text-slate-400">{stock.ticker}</span>
                  {stock.market && (
                    <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs font-bold border border-slate-200">
                      {stock.market}
                    </span>
                  )}
                </div>

                {/* 현재가: price가 없으면 '--' 표시 */}
                <div className={`text-4xl font-extrabold mt-2 flex items-baseline gap-3 ${
                  stock.isDown ? 'text-blue-600' : 'text-red-600'
                }`}>
                  {price != null ? `${price.toLocaleString()}원` : '--'}
                  {stock.changeAmount != null && (
                    <span className="text-xl font-semibold flex items-center">
                      {stock.isDown
                        ? <TrendingDown className="w-5 h-5 mr-1" />
                        : <TrendingUp   className="w-5 h-5 mr-1" />}
                      {Math.abs(stock.changeAmount).toLocaleString()} ({stock.change ?? '--'})
                    </span>
                  )}
                </div>
              </div>

              {/* 알림 & 북마크 버튼 */}
              <div className="flex gap-2 flex-shrink-0 ml-4">
                <button
                  onClick={() => setIsAlertOn(!isAlertOn)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors border ${
                    isAlertOn
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Bell className={`w-5 h-5 ${isAlertOn ? 'fill-indigo-700' : ''}`} />
                  <span className="hidden sm:inline text-sm">
                    {isAlertOn ? '주의보 켜짐' : '알림 받기'}
                  </span>
                </button>

                {/* ★ 북마크 버튼: 클릭하면 App.js의 toggleBookmark 호출 */}
                <button
                  onClick={() => onToggleBookmark(stock)}
                  className={`p-2 rounded-xl border transition-colors ${
                    isBookmarked
                      ? 'bg-yellow-50 border-yellow-200 text-yellow-500'
                      : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
                  }`}
                  title={isBookmarked ? '북마크 해제' : '북마크 추가'}
                >
                  <Bookmark className={`w-6 h-6 ${isBookmarked ? 'fill-yellow-500' : ''}`} />
                </button>
              </div>
            </div>

            {/* 통합 차트 영역 (서버 연동 전 플레이스홀더) */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">주가-감성 통합 차트</h2>
                {/* 기간 선택 버튼 */}
                <div className="flex gap-2">
                  {['1일', '1주', '1개월', '3개월', '1년'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setChartPeriod(t)}
                      className={`px-3 py-1 text-sm rounded-md font-medium transition-colors ${
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

              {/* 차트 플레이스홀더: 서버 연동 후 Recharts / Chart.js로 교체 예정 */}
              <div className="h-80 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <div className="w-3 h-3 bg-slate-800 rounded-sm" />주가 (원)
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <div className="w-3 h-3 bg-red-400 rounded-sm" />개미지수 (Score)
                  </div>
                </div>
                {/* 데코용 SVG 라인 */}
                <svg className="w-full h-full opacity-10" viewBox="0 0 1000 300" preserveAspectRatio="none">
                  <path d="M0,150 L200,140 L400,160 L600,120 L800,180 L1000,150" fill="none" stroke="#1e293b" strokeWidth="3" />
                  <path d="M0,200 L200,180 L400,190 L600,150 L800,220 L1000,200" fill="none" stroke="#f87171" strokeWidth="2" strokeDasharray="5,5" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-slate-400">
                    <Activity className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-sm">차트 데이터를 불러오는 중...</p>
                    <p className="text-xs mt-1 text-slate-300">
                      서버 연동 후 Recharts 차트가 표시됩니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 시장 데이터 카드들 */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold mb-4">시장 데이터 (Market Info)</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* ?? '--' : 값이 없으면 '--' 표시 */}
                <InfoCard label="거래량"              value={stock.volume  ?? '--'} />
                <InfoCard label="5일 이동평균 (MA5)"  value={stock.ma5     ?? '--'} />
                <InfoCard label="20일 이동평균 (MA20)" value={stock.ma20    ?? '--'} />
                <InfoCard label="52주 최저가"          value={stock.low52   ?? '--'} valueColor="text-blue-600" />
              </div>
            </div>
          </div>

          {/* ── 우측: AI 리포트 & 모의투자 (1/3) ── */}
          <div className="space-y-6">

            {/* AI 비명지수 리포트 */}
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-lg text-white relative overflow-hidden">
              {/* 장식용 배경 블러 */}
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-blue-500 rounded-full blur-[50px] opacity-20 pointer-events-none" />

              <div className="flex items-center gap-2 mb-6">
                <BrainCircuit className="w-6 h-6 text-indigo-400" />
                <h2 className="text-xl font-bold tracking-tight">AI 비명지수 리포트</h2>
              </div>

              {/* 개미 지수 게이지 */}
              <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 mb-6">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-slate-400 text-sm font-medium">현재 개미 지수</span>
                  <span className="text-3xl font-black text-blue-400">
                    {antIndex != null ? antIndex : '--'}
                  </span>
                </div>
                <div className="w-full bg-slate-700 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-500"
                    style={{ width: antIndex != null ? `${(antIndex + 100) / 2}%` : '50%' }}
                  />
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm font-bold text-blue-300 bg-blue-900/30 w-fit px-3 py-1.5 rounded-lg border border-blue-800">
                  <AlertTriangle className="w-4 h-4" />
                  {getAntIndexLabel(antIndex)}
                </div>
              </div>

              {/* AI 분석 텍스트 (서버에서 받아올 예정) */}
              <div className="space-y-3 text-sm">
                {stock.aiReport ? (
                  <>
                    <p className="text-slate-300 leading-relaxed">{stock.aiReport.summary}</p>
                    {stock.aiReport.prediction && (
                      <div className="p-3 bg-indigo-900/30 rounded-lg border border-indigo-800/50">
                        <div className="text-indigo-300 font-bold mb-2">T+1시간 방향성 예측</div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">{stock.aiReport.prediction.label}</span>
                          <span className="font-bold text-white">
                            {stock.aiReport.prediction.probability}% 확률
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2">
                          <div
                            className="bg-indigo-500 h-full rounded-full"
                            style={{ width: `${stock.aiReport.prediction.probability}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  // AI 리포트 데이터가 없을 때 안내 메시지
                  <div className="text-slate-400 text-sm text-center py-4">
                    AI 분석 리포트를 불러오는 중...
                  </div>
                )}
              </div>
            </div>

            {/* 모의투자 매매창 */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm sticky top-24">
              <div className="flex items-center gap-2 mb-6">
                <ShoppingCart className="w-6 h-6 text-slate-800" />
                <h2 className="text-xl font-bold">모의투자 (시장가 주문)</h2>
              </div>

              {/* 매수/매도 탭 */}
              <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                <button
                  onClick={() => setTradeType('BUY')}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${
                    tradeType === 'BUY'
                      ? 'bg-white text-red-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  매수
                </button>
                <button
                  onClick={() => setTradeType('SELL')}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${
                    tradeType === 'SELL'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  매도
                </button>
              </div>

              <div className="space-y-4">
                {/* 현재 시장가 표시 (수정 불가) */}
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">
                    주문 단가 (현재 시장가)
                  </label>
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 text-right cursor-not-allowed">
                    {price != null ? `${price.toLocaleString()} 원` : '-- 원'}
                  </div>
                </div>

                {/* 수량 입력 (- / + 버튼) */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-500">주문 수량</label>
                    <span className="text-xs text-slate-400">
                      최대 {maxQuantity != null ? `${maxQuantity}주` : '--'}
                    </span>
                  </div>
                  <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-slate-900">
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="px-4 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors border-r border-slate-300"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                      className="w-full text-center font-bold text-lg border-none outline-none bg-white"
                      min="1"
                    />
                    <button
                      onClick={() => setQuantity(q => q + 1)}
                      className="px-4 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors border-l border-slate-300"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 총 주문 금액 & 가용 예수금 */}
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-slate-500">총 주문 금액</span>
                    <span className="text-2xl font-black text-slate-900">
                      {totalOrderAmount != null
                        ? `${totalOrderAmount.toLocaleString()} 원`
                        : '-- 원'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">가용 예수금</span>
                    <span className="font-medium text-slate-600">
                      {myAsset?.cash != null
                        ? `${myAsset.cash.toLocaleString()} 원`
                        : '로그인 후 확인 가능'}
                    </span>
                  </div>
                </div>

                {/* 주문 실행 버튼 */}
                <button
                  className={`w-full py-4 rounded-xl font-bold text-white text-lg transition-colors shadow-md mt-4 ${
                    tradeType === 'BUY'
                      ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                      : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20'
                  }`}
                  onClick={() => {
                    // TODO: 서버에 주문 전송 로직 추가 예정
                    // 예: fetch('/api/trade', { method:'POST', body: JSON.stringify({...}) })
                    alert(`[모의투자] ${stock.name} ${quantity}주 ${tradeType === 'BUY' ? '매수' : '매도'} 주문`);
                  }}
                >
                  {tradeType === 'BUY' ? '시장가 매수' : '시장가 매도'}
                </button>
                <p className="text-center text-xs text-slate-400 mt-2">
                  * 모의투자는 클릭 시점의 시장 호가로 즉시 체결됩니다.
                </p>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

// =========================================================================
// InfoCard - 시장 데이터 표시용 미니 카드
// =========================================================================
function InfoCard({ label, value, valueColor = 'text-slate-900' }) {
  return (
    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
      <div className="text-xs font-bold text-slate-500 mb-1">{label}</div>
      <div className={`font-bold ${valueColor}`}>{value}</div>
    </div>
  );
}
