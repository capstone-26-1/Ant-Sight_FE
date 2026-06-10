import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Bell, Wallet, Activity, RefreshCw,
  Clock, ChevronRight, Search,
} from 'lucide-react';
import Sidebar from './Sidebar';
import { stockApi } from './api/stocks';
import {
  INITIAL_SEED, FEE_RATE, TAX_RATE_SELL,
  computeHoldingsValue, computeUnrealizedPL, computeRealizedPL,
} from './mockInvest/portfolio';
import { isMarketOpen } from './marketHours';

// =========================================================================
// MockInvestScreen — 모의투자 포트폴리오 대시보드
//
// 표시:
//   - 상단 요약: 총 평가액 / 현금 / 평가손익(%, 미실현) / 실현손익 누적
//   - 보유 종목 테이블: 종목·수량·평단가·현재가·평가액·평가손익·비중
//   - 거래 내역 (최신 20건)
//
// 주문 실행은 ExplorePageScreen 상세 패널에서. 본 화면은 조회 전용.
// =========================================================================
export default function MockInvestScreen({
  currentPage,
  onNavigate,
  unreadCount = 0,
  onToggleNotifications,
  authUser = null,
  portfolio,
}) {
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  const isLoggedIn = authUser?.type === 'user' || authUser?.type === 'guest';
  const holdingsTickers = Object.keys(portfolio?.holdings ?? {});

  const refreshQuotes = useCallback(() => {
    if (holdingsTickers.length === 0) return;
    setLoading(true);
    Promise.all(
      holdingsTickers.map(t =>
        stockApi.getQuote(t)
          .then(q => [t, q])
          .catch(() => [t, null])
      )
    )
      .then(entries => {
        setQuotes(Object.fromEntries(entries));
        setUpdatedAt(new Date());
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdingsTickers.join(',')]);

  useEffect(() => { refreshQuotes(); }, [refreshQuotes]);

  const currentPrices = useMemo(() => {
    const map = {};
    for (const [t, q] of Object.entries(quotes)) {
      if (q?.currentPrice != null) map[t] = q.currentPrice;
    }
    return map;
  }, [quotes]);

  const holdingsValue = useMemo(
    () => computeHoldingsValue(portfolio, currentPrices),
    [portfolio, currentPrices]
  );
  const { unrealizedPL, costBasis } = useMemo(
    () => computeUnrealizedPL(portfolio, currentPrices),
    [portfolio, currentPrices]
  );
  const realizedPL  = useMemo(() => computeRealizedPL(portfolio), [portfolio]);
  const totalValue  = (portfolio?.cash ?? 0) + holdingsValue;
  const totalReturn = (totalValue - INITIAL_SEED) / INITIAL_SEED;
  const unrealizedPct = costBasis > 0 ? unrealizedPL / costBasis : 0;
  const marketOpen = isMarketOpen();

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />

      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* 상단 헤더 */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-500" />
            <div className="text-lg font-bold text-slate-900">모의투자</div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ml-2 ${
              marketOpen ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}>
              {marketOpen ? '● 정규장' : '○ 장마감'}
            </span>
          </div>
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

        <div className="p-6 max-w-6xl mx-auto w-full space-y-5">

          {/* 요약 카드 */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard
              label="총 평가액"
              value={`${Math.round(totalValue).toLocaleString()}원`}
              sub={`${totalReturn >= 0 ? '+' : ''}${(totalReturn * 100).toFixed(2)}% (시드 ${(INITIAL_SEED / 10000).toLocaleString()}만)`}
              color={totalReturn >= 0 ? 'text-red-600' : 'text-blue-600'}
              big
            />
            <SummaryCard
              label="현금"
              value={`${Math.round(portfolio?.cash ?? 0).toLocaleString()}원`}
              sub={`총자산의 ${totalValue > 0 ? ((portfolio?.cash ?? 0) / totalValue * 100).toFixed(1) : '0.0'}%`}
            />
            <SummaryCard
              label="미실현 손익"
              value={`${unrealizedPL >= 0 ? '+' : ''}${Math.round(unrealizedPL).toLocaleString()}원`}
              sub={costBasis > 0 ? `${unrealizedPct >= 0 ? '+' : ''}${(unrealizedPct * 100).toFixed(2)}% (보유원가 대비)` : '보유 종목 없음'}
              color={unrealizedPL >= 0 ? 'text-red-600' : 'text-blue-600'}
            />
            <SummaryCard
              label="실현 손익"
              value={`${realizedPL >= 0 ? '+' : ''}${Math.round(realizedPL).toLocaleString()}원`}
              sub={`총 ${portfolio?.history?.length ?? 0}건 거래`}
              color={realizedPL > 0 ? 'text-red-600' : realizedPL < 0 ? 'text-blue-600' : 'text-slate-700'}
            />
          </section>

          {/* 보유 종목 */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-500" />
                <h2 className="font-bold text-slate-900">보유 종목</h2>
                <span className="text-xs text-slate-400">({holdingsTickers.length}개)</span>
              </div>
              <div className="flex items-center gap-2">
                {updatedAt && (
                  <span className="text-[10px] text-slate-400">
                    시세 {updatedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
                <button
                  onClick={refreshQuotes}
                  disabled={loading || holdingsTickers.length === 0}
                  className="flex items-center gap-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 px-2 py-1.5 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  시세 새로고침
                </button>
              </div>
            </div>

            {!isLoggedIn ? (
              <div className="py-12 text-center text-slate-400 text-sm">로그인 후 이용 가능합니다.</div>
            ) : holdingsTickers.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Wallet className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm mb-2">보유 종목이 없습니다.</p>
                <p className="text-xs text-slate-500 mb-4">
                  탐색 탭에서 종목 진입 → 매수/매도 박스에서 주문하세요.
                </p>
                <button
                  onClick={() => onNavigate('explore')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-700 transition-colors"
                >
                  <Search className="w-4 h-4" /> 종목 탐색
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <th className="p-3">종목</th>
                      <th className="p-3 text-right">수량</th>
                      <th className="p-3 text-right">평단가</th>
                      <th className="p-3 text-right">현재가</th>
                      <th className="p-3 text-right">평가액</th>
                      <th className="p-3 text-right">평가손익</th>
                      <th className="p-3 text-right">비중</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {holdingsTickers.map(t => {
                      const h = portfolio.holdings[t];
                      const cur = currentPrices[t];
                      const avg = h.totalCost / h.quantity;
                      const evalValue = cur != null ? cur * h.quantity : null;
                      const pl = evalValue != null ? evalValue - h.totalCost : null;
                      const plPct = pl != null && h.totalCost > 0 ? pl / h.totalCost : null;
                      const weight = totalValue > 0 && evalValue != null ? evalValue / totalValue : null;
                      return (
                        <tr
                          key={t}
                          className="hover:bg-slate-50 transition-colors cursor-pointer"
                          onClick={() => onNavigate('explore', { ticker: t, name: h.name })}
                        >
                          <td className="p-3">
                            <div className="font-bold text-sm text-slate-900">{h.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{t}</div>
                          </td>
                          <td className="p-3 text-right font-medium text-sm text-slate-700">
                            {h.quantity.toLocaleString()}주
                          </td>
                          <td className="p-3 text-right text-sm text-slate-600">
                            {Math.round(avg).toLocaleString()}
                          </td>
                          <td className="p-3 text-right text-sm font-bold text-slate-900">
                            {cur != null ? Math.round(cur).toLocaleString() : '—'}
                          </td>
                          <td className="p-3 text-right text-sm font-bold text-slate-900">
                            {evalValue != null ? Math.round(evalValue).toLocaleString() : '—'}
                          </td>
                          <td className={`p-3 text-right text-sm font-bold ${
                            pl == null ? 'text-slate-400'
                            : pl > 0 ? 'text-red-600'
                            : pl < 0 ? 'text-blue-600'
                            : 'text-slate-700'
                          }`}>
                            {pl != null ? (
                              <>
                                {pl > 0 ? '+' : ''}{Math.round(pl).toLocaleString()}
                                <div className="text-[10px] font-medium">
                                  ({plPct != null ? `${plPct > 0 ? '+' : ''}${(plPct * 100).toFixed(2)}%` : '—'})
                                </div>
                              </>
                            ) : '—'}
                          </td>
                          <td className="p-3 text-right text-xs text-slate-500">
                            {weight != null ? `${(weight * 100).toFixed(1)}%` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* 거래 내역 */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-500" />
                <h2 className="font-bold text-slate-900">거래 내역</h2>
                <span className="text-xs text-slate-400">최신 20건</span>
              </div>
              <div className="text-[10px] text-slate-400">
                수수료 {(FEE_RATE * 100).toFixed(3)}% · 매도세 {(TAX_RATE_SELL * 100).toFixed(2)}%
              </div>
            </div>
            {(portfolio?.history?.length ?? 0) === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">거래 내역이 없습니다.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {portfolio.history.slice(0, 20).map(t => (
                  <li
                    key={t.id}
                    className="p-3 flex items-center gap-3 hover:bg-slate-50 cursor-pointer"
                    onClick={() => onNavigate('explore', { ticker: t.ticker, name: t.name })}
                  >
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border flex-shrink-0 ${
                      t.type === 'BUY' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {t.type === 'BUY' ? '매수' : '매도'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-bold text-slate-900 truncate">{t.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">{t.ticker}</span>
                        {t.afterHours && (
                          <span className="text-[9px] text-slate-500 bg-slate-100 px-1 rounded flex-shrink-0">장마감가</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {t.quantity.toLocaleString()}주 × {Math.round(t.price).toLocaleString()}원
                        <span className="text-slate-400 ml-1.5">
                          (수수료 {Math.round(t.fee).toLocaleString()}{t.tax > 0 ? ` · 세 ${Math.round(t.tax).toLocaleString()}` : ''})
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-sm font-bold ${t.cashDelta > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                        {t.cashDelta > 0 ? '+' : ''}{Math.round(t.cashDelta).toLocaleString()}
                      </div>
                      {t.realizedPL != null && (
                        <div className={`text-[10px] font-bold ${
                          t.realizedPL > 0 ? 'text-red-500' : t.realizedPL < 0 ? 'text-blue-500' : 'text-slate-500'
                        }`}>
                          실현 {t.realizedPL > 0 ? '+' : ''}{Math.round(t.realizedPL).toLocaleString()}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400">
                        {new Date(t.executedAt).toLocaleString('ko-KR', {
                          month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            * 가상 자금으로 시뮬레이션하는 학습용 기능입니다. 시장가 주문만 지원하며, 호가/지정가/조건부 주문은 제공하지 않습니다.
            장마감 후 주문은 마지막 quote 가격으로 체결됩니다 ("장마감가" 라벨로 표시).
            데이터는 본 기기 (브라우저 localStorage) 에만 저장되며, 환경설정에서 초기화할 수 있습니다.
          </p>
        </div>
      </main>
    </div>
  );
}

function SummaryCard({ label, value, sub, color = 'text-slate-900', big = false }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="text-[10px] font-bold text-slate-500 uppercase">{label}</div>
      <div className={`${big ? 'text-xl' : 'text-base'} font-black mt-1 ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}
