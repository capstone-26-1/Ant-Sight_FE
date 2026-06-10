import { useState, useEffect, useMemo } from 'react';
import {
  Bell, ShieldCheck, BrainCircuit, AlertTriangle, Activity,
  ChevronDown, ChevronUp, BookOpen, RefreshCw,
} from 'lucide-react';
import Sidebar from './Sidebar';
import MarketZoneGauge from './MarketZoneGauge';
import VoljumpCardGrid from './VoljumpCardGrid';
import { antIndexApi, SENTIMENT_THEME } from './api/antIndex';
import WHITELIST from './data/whitelist.json';
import STOCK_CODES from './stockCodes.json';
import LLM_RULES from './data/llm_rules.json';

// ticker → { name } 빠른 조회 맵
const NAME_MAP = (() => {
  const m = new Map();
  for (const s of STOCK_CODES) m.set(s.ticker, s);
  return m;
})();

// 정렬 모드
const SORT_OPTIONS = [
  { id: 'score_desc', label: '개미지수 ↓' },
  { id: 'score_asc',  label: '개미지수 ↑' },
  { id: 'posts_desc', label: '게시글 수 ↓' },
  { id: 'ticker',     label: 'Ticker ↑' },
];

// =========================================================================
// AntStrategyScreen — 개미지수 투자법 (디리스킹) 분석 탭 (B-5)
//
// 구성:
//   1) MarketZoneGauge — 시장 zone 게이지 (디리스킹 가이드)
//   2) 화이트리스트 55종목 × 24h 평균 개미지수 그리드
//   3) "동작 원리" 박스 (정적)
//   4) 변동성 회피 (voljump) 패널 — "준비 중" 스켈레톤
// =========================================================================
export default function AntStrategyScreen({
  currentPage,
  onNavigate,
  unreadCount = 0,
  onToggleNotifications,
  authUser = null,
}) {
  const [scoreMap, setScoreMap] = useState(null);  // ticker → {avgScore, postCount}
  const [loading, setLoading]   = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sortId, setSortId] = useState('score_desc');
  const [showHow, setShowHow] = useState(true);

  const isLoggedInUser = authUser?.type === 'user';

  // ── 55종목 × 24h 평균 score 수집 ─────────────────────────────────────
  // ranking pos 50 ∪ neg 50 합집합 = 최근 24h 동안 게시글이 있던 종목 풀.
  // 55 화이트리스트 중 일부는 데이터 없을 수 있음 → null 로 표시.
  useEffect(() => {
    if (!isLoggedInUser) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      antIndexApi.getRanking({ window: '24h', direction: 'positive', limit: 50 }),
      antIndexApi.getRanking({ window: '24h', direction: 'negative', limit: 50 }),
    ])
      .then(([pos, neg]) => {
        if (cancelled) return;
        const map = new Map();
        for (const it of pos?.items ?? []) {
          map.set(it.ticker, { avgScore: Number(it.avgScore), postCount: it.postCount });
        }
        for (const it of neg?.items ?? []) {
          map.set(it.ticker, { avgScore: Number(it.avgScore), postCount: it.postCount });
        }
        setScoreMap(map);
      })
      .catch(() => {
        if (cancelled) return;
        setScoreMap(new Map());
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isLoggedInUser, refreshKey]);

  // 화이트리스트 + 점수 + 종목명 join
  const stocks = useMemo(() => {
    return WHITELIST.map(w => {
      const meta = NAME_MAP.get(w.ticker);
      const s    = scoreMap?.get(w.ticker);
      return {
        ticker: w.ticker,
        name:   meta?.name ?? w.ticker,
        avgScore:  s?.avgScore ?? null,
        postCount: s?.postCount ?? 0,
      };
    });
  }, [scoreMap]);

  // 정렬 적용 — null 점수는 항상 뒤로
  const sortedStocks = useMemo(() => {
    const arr = [...stocks];
    arr.sort((a, b) => {
      switch (sortId) {
        case 'score_asc': {
          const av = a.avgScore ?? Infinity;
          const bv = b.avgScore ?? Infinity;
          return av - bv;
        }
        case 'posts_desc':
          return (b.postCount ?? 0) - (a.postCount ?? 0);
        case 'ticker':
          return a.ticker.localeCompare(b.ticker);
        case 'score_desc':
        default: {
          const av = a.avgScore ?? -Infinity;
          const bv = b.avgScore ?? -Infinity;
          return bv - av;
        }
      }
    });
    return arr;
  }, [stocks, sortId]);

  const dataCount = stocks.filter(s => s.avgScore != null).length;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />

      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* 상단 헤더 */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-500" />
            <div className="text-lg font-bold text-slate-900">개미지수 투자법 (디리스킹)</div>
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

        <div className="p-6 max-w-6xl mx-auto w-full space-y-6">

          {/* 인트로 */}
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 mb-1">
              {LLM_RULES.ant_index_strategy?.name ?? '개미지수 디리스킹'}
            </h1>
            <p className="text-sm text-slate-500">
              {LLM_RULES.ant_index_strategy?.description}
              <span className="block text-slate-400 mt-1 text-xs">
                출처: {LLM_RULES.ant_index_strategy?.source}
              </span>
            </p>
          </div>

          {/* 1. 시장 zone 게이지 */}
          <MarketZoneGauge />

          {/* 2. 화이트리스트 55종목 그리드 */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-500" />
                <h2 className="font-bold text-slate-900">화이트리스트 종목 ({WHITELIST.length}개)</h2>
                <span className="text-xs text-slate-400">
                  · 24h 평균 개미지수
                  {!loading && ` · ${dataCount}/${WHITELIST.length}개 집계됨`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={sortId}
                  onChange={e => setSortId(e.target.value)}
                  className="text-xs font-medium border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 hover:bg-slate-50"
                >
                  {SORT_OPTIONS.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => setRefreshKey(k => k + 1)}
                  disabled={loading}
                  className="flex items-center gap-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 px-2 py-1.5 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  새로고침
                </button>
              </div>
            </div>

            {!isLoggedInUser ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                로그인 후 화이트리스트 데이터를 확인할 수 있습니다.
              </div>
            ) : loading && !scoreMap ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                <Activity className="w-8 h-8 mx-auto mb-2 text-slate-300 animate-pulse" />
                개미지수 수집 중...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 p-4">
                {sortedStocks.map(s => (
                  <StockCard
                    key={s.ticker}
                    stock={s}
                    onClick={() => onNavigate('explore', { ticker: s.ticker, name: s.name })}
                  />
                ))}
              </div>
            )}
          </section>

          {/* 3. 동작 원리 */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <button
              onClick={() => setShowHow(v => !v)}
              className="w-full px-5 py-4 border-b border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-500" />
                <h2 className="font-bold text-slate-900">동작 원리</h2>
              </div>
              {showHow ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {showHow && (
              <div className="px-5 py-5 space-y-3 text-sm text-slate-700 leading-relaxed">
                <p>
                  <b className="text-slate-900">개미지수</b> = 한국 종목토론방 309만 건 게시글을
                  KLUE-RoBERTa multi-task 모델로 분석한 <b>군중심리 게이지</b> (0~100).
                  CNN 공포탐욕지수와 같은 위치의 디리스킹 지표입니다.
                </p>
                <p>
                  <b className="text-slate-900">투자법</b>: 시장 zone에 따라 주식 비중을 자동 조정합니다.
                  탐욕·극탐욕 구간에선 비중을 60% / 30%로 축소하여 과열 리스크를 회피합니다.
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5">
                  <div className="font-bold text-slate-600 mb-1">Zone → 권장 주식 비중</div>
                  {Object.entries(LLM_RULES.ant_index_strategy?.rules?.weight_by_zone ?? {}).map(([zone, w]) => (
                    <div key={zone} className="flex items-center justify-between">
                      <span className="text-slate-700">{zone}</span>
                      <span className="font-bold text-slate-900">{Math.round(w * 100)}%</span>
                    </div>
                  ))}
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-amber-800 leading-relaxed">
                    이는 <b>비중 가이드</b>이지 <b>매매 추천</b>이 아닙니다.
                    개별 종목 진입·청산 타이밍은 별도 분석이 필요합니다.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* 4. 변동성 회피 (Model B — VolJump Alert) */}
          <VoljumpCardGrid
            title="변동성 회피 종목 (Model B)"
            minProb={0.1}
            limit={20}
            compact
            enabled={isLoggedInUser}
            onSelect={(stock) => onNavigate('explore', stock)}
          />

        </div>
      </main>
    </div>
  );
}

// ── 종목 카드 ───────────────────────────────────────────────────────────
function StockCard({ stock, onClick }) {
  const { ticker, name, avgScore, postCount } = stock;
  const sentiment = avgScore == null
    ? null
    : avgScore >= 70 ? 'POSITIVE'
    : avgScore <= 30 ? 'NEGATIVE'
    : 'NEUTRAL';
  const theme = sentiment ? SENTIMENT_THEME[sentiment] : null;

  return (
    <button
      onClick={onClick}
      className="text-left bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm rounded-xl p-3 transition-all flex items-center justify-between gap-2 min-w-0"
    >
      <div className="min-w-0 flex-1">
        <div className="font-bold text-sm text-slate-900 truncate">{name}</div>
        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{ticker}</div>
      </div>
      <div className="text-right flex-shrink-0">
        {avgScore != null ? (
          <>
            <div className={`text-base font-black flex items-center justify-end gap-1 ${theme?.text ?? 'text-slate-700'}`}>
              <BrainCircuit className="w-3.5 h-3.5" />
              {avgScore.toFixed(1)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              글 {postCount.toLocaleString()}
            </div>
          </>
        ) : (
          <span className="text-xs font-medium text-slate-300">데이터 없음</span>
        )}
      </div>
    </button>
  );
}
