import { useMemo, useState, useEffect } from 'react';
import {
  Activity, Bell, BrainCircuit, TrendingUp, TrendingDown, Minus,
  Trophy, Percent, Flame, ArrowUpDown, ChevronRight,
} from 'lucide-react';
import Sidebar from './Sidebar';
import TOP_100_STOCKS from './top100Stocks.json';
import { generateMarketRankings } from './aiModelDummy';
import { antIndexApi } from './api/antIndex';

// =========================================================================
// MarketAnalysisScreen — 시장 분석 (AI 랭킹 탭)
//
// 변경 사항(요구사항):
//   - 기존 "전체 시장 개미 지수" / "섹터별 카드" / "AI 요약" 제거
//   - Top 100 종목 × AntModel 예측 결과를 다양한 기준으로 랭킹
//   - 탭: 개미지수 극단치 | 예측 수익률 | 예측 승률 | 시그널 강도
//   - 행 클릭 시 탐색 탭에서 해당 종목 상세로 이동
//
// 데이터:
//   - 실제 시세/예측 API가 없으므로 aiModelDummy.generateMarketRankings로
//     ticker 시드 기반 결정론적 더미 (antIndex/changeRate/예측치) 생성.
//   - 같은 종목은 같은 결과 → 데모 안정.
//
// props:
//   currentPage, onNavigate, unreadCount, onToggleNotifications
//   onSelectStock(stock) — 행 클릭 시 호출
// =========================================================================

const RANK_MODES = [
  {
    id: 'ant-extreme',
    label: '개미지수 극단치',
    icon: Flame,
    description: '공포/탐욕 극단치 종목 — 비대칭 진입 기회',
    metricLabel: '개미지수',
    // 중립(50)으로부터의 거리로 정렬. antIndex가 null이면 -1로 후순위.
    sort: (a, b) => {
      const ax = a.antIndex == null ? -1 : Math.abs(a.antIndex - 50);
      const bx = b.antIndex == null ? -1 : Math.abs(b.antIndex - 50);
      return bx - ax;
    },
    metricFmt: r => r.antIndex == null ? '—' : Number(r.antIndex).toFixed(1),
    metricColor: r => r.antIndex == null ? 'text-slate-300'
      : r.antIndex <= 35 ? 'text-blue-600' : r.antIndex >= 65 ? 'text-red-600' : 'text-slate-600',
  },
  {
    id: 'expected-return',
    label: '예측 수익률',
    icon: Percent,
    description: 'AntModel 단기 기대 수익률 상위',
    metricLabel: '기대 수익률',
    sort: (a, b) => Math.abs(b.expectedReturn) - Math.abs(a.expectedReturn),
    metricFmt: r => `${r.expectedReturn > 0 ? '+' : ''}${r.expectedReturn}%`,
    metricColor: r => r.expectedReturn > 0 ? 'text-red-600' : r.expectedReturn < 0 ? 'text-blue-600' : 'text-slate-600',
  },
  {
    id: 'win-rate',
    label: '예측 승률',
    icon: Trophy,
    description: 'AntModel 단기 승률 상위',
    metricLabel: '예측 승률',
    sort: (a, b) => b.winRate - a.winRate,
    metricFmt: r => `${r.winRate}%`,
    metricColor: () => 'text-emerald-600',
  },
  {
    id: 'conviction',
    label: '시그널 강도',
    icon: Activity,
    description: '확신도(strong > medium > low) 상위',
    metricLabel: '확신도',
    sort: (a, b) => {
      const c = CONV_W[b.conviction] - CONV_W[a.conviction];
      if (c) return c;
      const ax = a.antIndex == null ? -1 : Math.abs(a.antIndex - 50);
      const bx = b.antIndex == null ? -1 : Math.abs(b.antIndex - 50);
      return bx - ax;
    },
    metricFmt: r => CONV_KOR[r.conviction] ?? '-',
    metricColor: r => r.conviction === 'high' ? 'text-violet-600' : r.conviction === 'medium' ? 'text-violet-500' : 'text-slate-500',
  },
];

const CONV_W   = { high: 3, medium: 2, low: 1 };
const CONV_KOR = { high: '강함', medium: '보통', low: '약함' };

const DIR_CFG = {
  BUY:  { label: '매수', color: 'text-red-600',  bg: 'bg-red-50 border-red-200',   Icon: TrendingUp   },
  SELL: { label: '매도', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', Icon: TrendingDown },
  HOLD: { label: '관망', color: 'text-slate-600',bg: 'bg-slate-50 border-slate-200',Icon: Minus       },
};

export default function MarketAnalysisScreen({
  currentPage,
  onNavigate,
  unreadCount = 0,
  onToggleNotifications,
  onSelectStock,
  authUser = null,
}) {
  const [activeMode, setActiveMode] = useState(RANK_MODES[0].id);
  const [directionFilter, setDirectionFilter] = useState('ALL'); // ALL | BUY | SELL | HOLD

  // 실제 개미지수 점수 맵 (ticker → score 0~100). 비어 있으면 dummy 사용 (#1 fix).
  const [realScoreMap, setRealScoreMap] = useState(null);

  const isLoggedInUser = authUser?.type === 'user';

  // ── 랭킹 API로 Top 100 가능한 만큼 실제 개미지수 수집 (positive+negative limit=50씩) ──
  // 두 방향 합쳐 최대 100 ticker. 로그인 사용자만 호출.
  useEffect(() => {
    if (!isLoggedInUser) return;
    let cancelled = false;
    Promise.all([
      antIndexApi.getRanking({ window: '24h', direction: 'positive', limit: 50 }),
      antIndexApi.getRanking({ window: '24h', direction: 'negative', limit: 50 }),
    ])
      .then(([pos, neg]) => {
        if (cancelled) return;
        const map = new Map();
        for (const it of pos?.items ?? []) map.set(it.ticker, it.avgScore);
        for (const it of neg?.items ?? []) map.set(it.ticker, it.avgScore);
        setRealScoreMap(map);
      })
      .catch(err => {
        if (cancelled || err.status === 401) return;
        setRealScoreMap(null);
      });
    return () => { cancelled = true; };
  }, [isLoggedInUser]);

  // Top 100 × 모델 예측 — ticker 시드 기반 결정론적 (antIndex 외 필드는 모델 더미 유지)
  const dummyRankings = useMemo(() => generateMarketRankings(TOP_100_STOCKS), []);

  // 실제 개미지수로 antIndex만 덮어쓰기 — 매칭 안되는 종목은 null (테이블에 "—" 표시)
  // BE/FE 모두 0~100 스케일 (50=중립) 사용 → 변환 없이 그대로 주입.
  const rankings = useMemo(() => {
    if (!realScoreMap) return dummyRankings;
    return dummyRankings.map(r => {
      const score = realScoreMap.get(r.ticker);
      return {
        ...r,
        antIndex: score != null ? Number(score) : null,
      };
    });
  }, [dummyRankings, realScoreMap]);

  const mode = RANK_MODES.find(m => m.id === activeMode) ?? RANK_MODES[0];

  // 정렬 + 방향 필터 적용. ant-extreme 모드에선 antIndex=null 종목을 후순위로 밀어둠.
  const sortedList = useMemo(() => {
    const filtered = directionFilter === 'ALL'
      ? rankings
      : rankings.filter(r => r.direction === directionFilter);
    return [...filtered].sort(mode.sort).slice(0, 30);
  }, [rankings, mode, directionFilter]);

  // 방향별 집계 (상단 요약 카드)
  const summary = useMemo(() => {
    const cnt = { BUY: 0, SELL: 0, HOLD: 0 };
    rankings.forEach(r => { cnt[r.direction] = (cnt[r.direction] ?? 0) + 1; });
    return cnt;
  }, [rankings]);

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">

      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />

      <main className="flex-1 flex flex-col h-screen overflow-y-auto">

        {/* 상단 헤더 */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-indigo-500" />
            <div className="text-lg font-bold text-slate-900">시장 분석 · AI 랭킹</div>
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

          {/* 인트로 */}
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">AntModel 기반 시장 랭킹</h1>
              <p className="text-sm text-slate-500 mt-1">
                시총 Top 100 종목에 대해 모델이 산출한 신호·승률·기대수익률을 다양한 기준으로 정렬합니다.
                <span className="ml-1 text-slate-400">
                  (개미지수 = 실 API · 최근 24h 평균 점수 / 모델 예측치는 데모 더미)
                </span>
              </p>
            </div>
          </div>

          {/* 방향별 집계 카드 */}
          <div className="grid grid-cols-3 gap-3">
            <SummaryCard
              label="모델 매수 시그널"
              count={summary.BUY}
              accent="red"
              active={directionFilter === 'BUY'}
              onClick={() => setDirectionFilter(directionFilter === 'BUY' ? 'ALL' : 'BUY')}
            />
            <SummaryCard
              label="관망"
              count={summary.HOLD}
              accent="slate"
              active={directionFilter === 'HOLD'}
              onClick={() => setDirectionFilter(directionFilter === 'HOLD' ? 'ALL' : 'HOLD')}
            />
            <SummaryCard
              label="모델 매도/차익 시그널"
              count={summary.SELL}
              accent="blue"
              active={directionFilter === 'SELL'}
              onClick={() => setDirectionFilter(directionFilter === 'SELL' ? 'ALL' : 'SELL')}
            />
          </div>

          {/* 랭킹 모드 탭 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex gap-1 p-2 bg-slate-50 border-b border-slate-200 overflow-x-auto">
              {RANK_MODES.map(rm => {
                const isActive = rm.id === activeMode;
                const Icon = rm.icon;
                return (
                  <button
                    key={rm.id}
                    onClick={() => setActiveMode(rm.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-sm border border-indigo-200'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {rm.label}
                  </button>
                );
              })}
            </div>

            {/* 모드 설명 + 필터 상태 */}
            <div className="px-5 py-3 border-b border-slate-100 bg-white flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5" />
                {mode.description} · Top {sortedList.length}
              </p>
              {directionFilter !== 'ALL' && (
                <button
                  onClick={() => setDirectionFilter('ALL')}
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
                >
                  필터: {DIR_CFG[directionFilter].label} 해제 ×
                </button>
              )}
            </div>

            {/* 랭킹 테이블 */}
            <div>
              {/* 헤더 */}
              <div className="hidden sm:grid grid-cols-12 px-5 py-2 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-100 bg-slate-50/50">
                <div className="col-span-1">#</div>
                <div className="col-span-4">종목</div>
                <div className="col-span-2 text-right">{mode.metricLabel}</div>
                <div className="col-span-2 text-right">방향</div>
                <div className="col-span-2 text-right">예측승률·홀딩</div>
                <div className="col-span-1 text-right">등락률</div>
              </div>
              {sortedList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  해당 조건의 종목이 없습니다.
                </div>
              ) : (
                sortedList.map((row, idx) => {
                  const dirCfg = DIR_CFG[row.direction];
                  return (
                    <button
                      key={row.ticker}
                      onClick={() => onSelectStock?.({ ticker: row.ticker, name: row.name, marketCapRank: row.marketCapRank, antIndex: row.antIndex })}
                      className="w-full grid grid-cols-12 px-5 py-3 hover:bg-indigo-50/40 border-b border-slate-50 transition-colors text-left items-center"
                    >
                      {/* 순위 */}
                      <div className="col-span-1 text-xs font-black text-slate-400">
                        {idx + 1}
                      </div>

                      {/* 종목 */}
                      <div className="col-span-11 sm:col-span-4 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 truncate">{row.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{row.ticker}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          시총 #{row.marketCapRank}
                        </div>
                      </div>

                      {/* 모드별 메트릭 */}
                      <div className="hidden sm:block col-span-2 text-right">
                        <span className={`text-base font-black ${mode.metricColor(row)}`}>
                          {mode.metricFmt(row)}
                        </span>
                      </div>

                      {/* 방향 */}
                      <div className="hidden sm:flex col-span-2 justify-end">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-bold ${dirCfg.bg}`}>
                          <dirCfg.Icon className={`w-3.5 h-3.5 ${dirCfg.color}`} />
                          <span className={dirCfg.color}>{dirCfg.label}</span>
                        </span>
                      </div>

                      {/* 승률·홀딩 */}
                      <div className="hidden sm:block col-span-2 text-right text-[11px] text-slate-600">
                        <div className="font-bold">{row.winRate}%</div>
                        <div className="text-slate-400">
                          {row.holdingDays > 0 ? `${row.holdingDays}일 홀딩` : '관망'}
                        </div>
                      </div>

                      {/* 등락률 */}
                      <div className="hidden sm:block col-span-1 text-right">
                        <span className={`text-xs font-bold ${row.changeRate > 0 ? 'text-red-600' : row.changeRate < 0 ? 'text-blue-600' : 'text-slate-500'}`}>
                          {row.changeRate > 0 ? '+' : ''}{row.changeRate}%
                        </span>
                      </div>

                      {/* 모바일: 컴팩트 메트릭 */}
                      <div className="col-span-12 sm:hidden flex items-center gap-2 mt-1.5">
                        <span className={`text-sm font-black ${mode.metricColor(row)}`}>
                          {mode.metricFmt(row)}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold ${dirCfg.bg}`}>
                          <dirCfg.Icon className={`w-3 h-3 ${dirCfg.color}`} />
                          <span className={dirCfg.color}>{dirCfg.label}</span>
                        </span>
                        <span className="text-[10px] text-slate-500">승률 {row.winRate}%</span>
                        <ChevronRight className="w-4 h-4 text-slate-300 ml-auto" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            * 개미지수는 최근 24시간 평균 점수(/api/ant-index/ranking) 실측치입니다. 수집 데이터가 없는 종목은 "—"로 표시됩니다.
            예측 수익률·승률·시그널 강도는 실제 모델 API 연동 전 데모 더미이며 실제 투자 판단에 사용하지 마세요.
          </p>
        </div>
      </main>
    </div>
  );
}

// ── 방향별 집계 카드 ─────────────────────────────────────────────────────
function SummaryCard({ label, count, accent, active, onClick }) {
  const cfg = {
    red:   { ring: 'border-red-200',   bg: 'bg-red-50',   text: 'text-red-700',   activeBg: 'bg-red-100 border-red-300' },
    blue:  { ring: 'border-blue-200',  bg: 'bg-blue-50',  text: 'text-blue-700',  activeBg: 'bg-blue-100 border-blue-300' },
    slate: { ring: 'border-slate-200', bg: 'bg-slate-50', text: 'text-slate-700', activeBg: 'bg-slate-100 border-slate-300' },
  }[accent];

  return (
    <button
      onClick={onClick}
      className={`rounded-2xl p-4 border transition-all text-left ${active ? cfg.activeBg : `${cfg.bg} ${cfg.ring} hover:shadow-sm`}`}
    >
      <div className="text-xs font-bold text-slate-500 mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-3xl font-black ${cfg.text}`}>{count}</span>
        <span className="text-xs text-slate-500">개</span>
      </div>
      <div className="text-[10px] text-slate-500 mt-1">
        {active ? '필터 적용 중 (클릭으로 해제)' : '클릭하여 이 시그널만 보기'}
      </div>
    </button>
  );
}
