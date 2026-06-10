import { useState, useEffect, useMemo } from 'react';
import {
  Bell, Search, Activity, Clock, X, Bookmark,
  TrendingDown, TrendingUp, BrainCircuit, AlertTriangle,
  ShoppingCart, ChevronRight, RefreshCw, Minus, Plus, CheckCircle2,
  Target, Trophy, Percent, Timer, ShieldAlert,
} from 'lucide-react';
import Sidebar from './Sidebar';
import { stockApi } from './api/stocks';
import { candlesApi } from './api/candles';
import { antIndexApi, SENTIMENT_THEME, getAntIndexLabel } from './api/antIndex';
import {
  voljumpApi, SEVERITY_THEME, STATUS_FALLBACK_THEME, STATUS_TOOLTIP, fmtJumpProb,
} from './api/voljump';
import CandleChart, { aggregateCandles } from './CandleChart';
import { isMarketOpen, lastMarketDataTime } from './marketHours';
import STOCK_CODES from './stockCodes.json';
import TOP_100_STOCKS from './top100Stocks.json';
import WHITELIST from './data/whitelist.json';
import LLM_RULES from './data/llm_rules.json';
import { deriveAntIndex, calculateEntryZone } from './aiModelDummy';
// B-7: 전략별 의견
import { fiveMinToDaily } from './strategies/indicators';
import { evaluateChatGPT235 } from './strategies/chatgpt235';
import { evaluateAntIndex } from './strategies/antIndexSignal';
import { getMarketSnapshot, getClaudeMarketOpinion, getGeminiMarketOpinion } from './strategies/marketProxy';

// ─── 시간 상수 (다른 const 들이 참조하므로 가장 먼저 선언) ─────────────
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS  = 24 * HOUR_MS;

// B-7 전략 평가용 별도 캔들 fetch — MA60 daily 평가에 ≈ 100 calendar days 필요.
// BE 7일 한도는 candlesApi.getCandlesChunked 가 청크로 우회.
const STRATEGY_LOOKBACK_MS = 100 * DAY_MS;
const WHITELIST_SET = new Set(WHITELIST.map(w => w.ticker));

// 모의투자 — LLM 백테스트와 동일 거래비용 (UI 표시용)
const MOCK_FEE_RATE = 0.00015;
const MOCK_TAX_RATE_SELL = 0.0020;

// 개미지수 기간 선택자 — 기간별 lookback + BE interval 매핑
const ANT_PERIOD_CONFIG = {
  '24h': { label: '24시간', lookbackMs: 24 * HOUR_MS, interval: '15m' },
  '7d':  { label: '7일',    lookbackMs: 7 * DAY_MS,   interval: '1h'  },
  '30d': { label: '30일',   lookbackMs: 30 * DAY_MS,  interval: '1d'  },
};

// 활성종목 기본 노출 — 시총 Top 100을 모두 보여준다 (스크롤 가능).
// 검색은 전체 STOCK_CODES 풀에서 수행하여 비활성 종목도 검색 가능.
const DEFAULT_ACTIVE_LIST = TOP_100_STOCKS;

// 캔들 API는 5분 단위로만 갱신되므로 그 안에선 재요청 의미 없음.
const CANDLE_REFRESH_MS = 5 * 60 * 1000;
const QUOTE_POLL_MS     = 5 * 1000;
// 최신 개미지수는 분 단위로 갱신될 수 있어 60s 간격 폴링.
const ANT_LATEST_POLL_MS = 60 * 1000;

// 시간프레임별 캔들 lookback — 같은 raw 데이터를 재포맷하지 않고
// 각 timeframe 에 맞는 시야 제공:
//   5m  → 6시간 (당일 인트라데이) / 15m → 3일 / 30m → 5일 / 1h → 10일
const CANDLE_LOOKBACK_BY_TIMEFRAME = {
  15:  3 * DAY_MS,
  30:  5 * DAY_MS,
  60: 10 * DAY_MS,
};
// BE 단일 호출 한도 (6일). 이보다 길면 candlesApi.getCandlesChunked 사용.
const CANDLE_SINGLE_FETCH_LIMIT_MS = 6 * DAY_MS;

// 에러 status → 사용자 메시지
function formatApiError(err, fallback) {
  if (err.status === 404) return '존재하지 않는 종목입니다.';
  if (err.status === 502) return '외부 시세 API 장애입니다. 잠시 후 다시 시도해주세요.';
  if (err.status === 500 || err.status === 503) return '서버 오류로 시세를 가져오지 못했습니다.';
  return err.message || fallback;
}

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
  authUser = null,
  portfolio,
  onExecuteOrder,
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

  // 종목 상세 패널 - 알림 로컬 상태
  const [isAlertOn, setIsAlertOn]   = useState(false);
  // 모의투자 주문 폼 (시장가) — 종목 변경 시 자동 초기화
  const [tradeType, setTradeType] = useState('BUY');
  const [orderQty,  setOrderQty]  = useState(1);
  const [orderToast, setOrderToast] = useState(null);  // { type: 'success'|'error', message }

  // 실시간 시세(/quote)
  const [quote, setQuote]           = useState(null);
  const [quoteError, setQuoteError] = useState(null);
  // 연속 실패 카운터가 임계치를 넘으면 폴링을 멈추고 수동 재시도 버튼을 보여준다.
  const [quotePollPaused, setQuotePollPaused] = useState(false);
  const [quoteRetryKey, setQuoteRetryKey] = useState(0);

  // 장중/장마감 상태 (30s 간격으로 갱신 — 09:00/15:30 전환 표시용)
  const [marketOpen, setMarketOpen] = useState(() => isMarketOpen());
  useEffect(() => {
    const id = setInterval(() => setMarketOpen(isMarketOpen()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  // 5분봉(/candles) — limit=500 (≈ 6 거래일치). 다른 시간프레임은 클라이언트 집계.
  const [candles, setCandles]         = useState([]);
  const [candleLoading, setCandleLoading] = useState(false);
  const [candleError, setCandleError] = useState(null);
  // 5분봉 강제 재요청 트리거 (새로고침 버튼 / 5분 인터벌)
  const [candleReloadKey, setCandleReloadKey] = useState(0);
  // 시간프레임 (분): 5 | 15 | 30 | 60
  const [timeframeMin, setTimeframeMin] = useState(15);

  // 개미지수 — 최신 점수(/api/ant-index/{ticker}/latest)
  const [antLatest, setAntLatest]       = useState(null);
  const [antLatestError, setAntLatestError] = useState(null); // { status, message }
  // 개미지수 — 시계열(/api/ant-index/{ticker}). 기간 선택자로 lookback + interval 변경.
  const [antSeries, setAntSeries]       = useState(null);
  const [antPeriod, setAntPeriod] = useState('24h');  // '24h' | '7d' | '30d'

  // B-7 전략 평가용: 100일 일봉 (5분봉 fetch → 일봉 집계)
  const [strategyDaily, setStrategyDaily] = useState([]);
  const [strategyLoading, setStrategyLoading] = useState(false);
  // B-7 시장 단위 점수 (AntModel 평가 입력)
  const [marketScore, setMarketScore] = useState(null);
  // B-7 전략 상세 모달
  const [activeStrategyId, setActiveStrategyId] = useState(null);
  // Model B — 변동성 점프 경보 (종목 단위)
  const [voljumpDetail, setVoljumpDetail] = useState(null);
  const [voljumpHistory, setVoljumpHistory] = useState(null);
  const [voljumpStatus, setVoljumpStatus] = useState(null);  // null | 404 | other err
  // 검색 결과 "분석 가능 종목만" 필터 토글
  const [whitelistOnly, setWhitelistOnly] = useState(false);

  const isLoggedInUser = authUser?.type === 'user';

  // ── initialStock 연동 ─────────────────────────────────────────────────
  useEffect(() => {
    setSelectedStock(initialStock || null);
    if (initialStock) {
      setIsAlertOn(false);
      setTradeType('BUY');
      setOrderQty(1);
      setOrderToast(null);
    }
  }, [initialStock]);

  // 최근 검색어 localStorage 저장
  useEffect(() => {
    localStorage.setItem('antsight_searches', JSON.stringify(recentSearches));
  }, [recentSearches]);

  // ── 선택 종목 변경 시 시세 state 초기화 ────────────────────────────────
  useEffect(() => {
    setQuote(null);
    setQuoteError(null);
    setQuotePollPaused(false);
    setCandles([]);
    setCandleError(null);
    setAntLatest(null);
    setAntLatestError(null);
    setAntSeries(null);
    setStrategyDaily([]);
    setActiveStrategyId(null);
    setVoljumpDetail(null);
    setVoljumpHistory(null);
    setVoljumpStatus(null);
  }, [selectedStock?.ticker]);

  // ── Model B 변동성 경보 — 종목 단위 (P1) + 30일 추이 (P2) ───────────
  // 일배치라 폴링 의미 X. 진입 시 1회 fetch.
  useEffect(() => {
    const ticker = selectedStock?.ticker;
    if (!ticker || !isLoggedInUser) return;
    let cancelled = false;

    voljumpApi.getDetail(ticker)
      .then(d => { if (!cancelled) { setVoljumpDetail(d); setVoljumpStatus(null); } })
      .catch(err => {
        if (cancelled || err.status === 401) return;
        setVoljumpDetail(null);
        setVoljumpStatus(err.status ?? 'error');
      });

    voljumpApi.getHistory(ticker, { days: 30 })
      .then(h => { if (!cancelled) setVoljumpHistory(h); })
      .catch(() => { if (!cancelled) setVoljumpHistory(null); });

    return () => { cancelled = true; };
  }, [selectedStock?.ticker, isLoggedInUser]);

  // ── B-7: 100일 일봉 fetch (전략 평가용) ───────────────────────────────
  // 차트용 7일 fetch와 별도. MA60 + mom60 평가에 60거래일 ≈ 100일 필요.
  useEffect(() => {
    const ticker = selectedStock?.ticker;
    if (!ticker || !isLoggedInUser) return;
    let cancelled = false;
    setStrategyLoading(true);
    const from = new Date(Date.now() - STRATEGY_LOOKBACK_MS);
    // 청크 fetch: BE 7일 한도 우회. 100일 = 약 17개 청크 병렬.
    candlesApi.getCandlesChunked(ticker, { from, withAntIndex: false })
      .then(resp => {
        if (cancelled) return;
        const daily = fiveMinToDaily(resp?.points ?? []);
        setStrategyDaily(daily);
      })
      .catch(err => {
        if (cancelled || err.status === 401) return;
        setStrategyDaily([]);
      })
      .finally(() => { if (!cancelled) setStrategyLoading(false); });
    return () => { cancelled = true; };
  }, [selectedStock?.ticker, isLoggedInUser]);

  // ── B-7: 시장 단위 개미지수 (AntModel 평가 입력) ──────────────────────
  // MarketZoneGauge 와 같은 산출. 종목 변경 시 1회 fetch (캐시 없음 — 단순화).
  useEffect(() => {
    if (!selectedStock?.ticker || !isLoggedInUser) return;
    let cancelled = false;
    Promise.all([
      antIndexApi.getRanking({ window: '24h', direction: 'positive', limit: 50 }),
      antIndexApi.getRanking({ window: '24h', direction: 'negative', limit: 50 }),
    ])
      .then(([pos, neg]) => {
        if (cancelled) return;
        const map = new Map();
        for (const it of pos?.items ?? []) map.set(it.ticker, Number(it.avgScore));
        for (const it of neg?.items ?? []) map.set(it.ticker, Number(it.avgScore));
        const vals = [...map.values()].filter(Number.isFinite);
        if (vals.length) {
          setMarketScore(vals.reduce((s, v) => s + v, 0) / vals.length);
        }
      })
      .catch(() => { /* 시장 평균은 nice-to-have — 실패 시 null 유지 */ });
    return () => { cancelled = true; };
  }, [selectedStock?.ticker, isLoggedInUser]);

  // ── /quote 5초 폴링 (장중에만, 10s TTL 캐시라 안전, 연속 3회 실패 시 일시중단) ─
  // 장마감 시: 초기 1회만 조회(최종가 표시) → 폴링 인터벌은 돌지만 fetch는 skip.
  // 장중 재진입(09:00 도달) 시 자동으로 폴링 재개.
  useEffect(() => {
    const ticker = selectedStock?.ticker;
    if (!ticker || !isLoggedInUser) return;

    let cancelled = false;
    let failureCount = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;
    let intervalId = null;

    const stopPolling = () => {
      if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const fetchQuote = () => {
      stockApi.getQuote(ticker)
        .then(data => {
          if (cancelled) return;
          failureCount = 0;
          setQuote(data);
          setQuoteError(null);
          setQuotePollPaused(false);
        })
        .catch(err => {
          if (cancelled) return;
          if (err.status === 401) return;
          failureCount += 1;
          setQuoteError(formatApiError(err, '시세 조회 실패'));
          if (err.status === 404 || failureCount >= MAX_CONSECUTIVE_FAILURES) {
            stopPolling();
            setQuotePollPaused(true);
          }
        });
    };

    // 진입 시 1회 무조건 조회 (장마감 시에도 최종가는 보여줘야 함)
    fetchQuote();

    // 인터벌은 항상 돌리되, 장마감 시점에는 fetch skip → 추가 요청 없음
    intervalId = setInterval(() => {
      if (!isMarketOpen()) return;
      fetchQuote();
    }, QUOTE_POLL_MS);

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [selectedStock?.ticker, isLoggedInUser, quoteRetryKey]);

  // ── /candles 진입 시 + 시간프레임 변경 시 + 새로고침 + 5분 주기 재요청 ─
  // 신규 엔드포인트 /api/candles/{ticker} (캔들 + 개미지수 합본).
  // 시간프레임별 lookback 다름 → timeframe 바뀌면 새 fetch (같은 raw 데이터 재포맷 X).
  useEffect(() => {
    const ticker = selectedStock?.ticker;
    if (!ticker || !isLoggedInUser) return;

    let cancelled = false;
    setCandleLoading(true);

    const lookbackMs = CANDLE_LOOKBACK_BY_TIMEFRAME[timeframeMin] ?? DAY_MS;
    // 장 외 시간엔 'now' 부터 lookback 하면 빈 윈도우가 됨 (예: 일요일 오후의 5m 6h).
    // lastMarketDataTime() = 직전 영업일 15:30 KST 로 anchor 해 항상 실데이터 구간 보장.
    const to   = lastMarketDataTime();
    const from = new Date(to.getTime() - lookbackMs);
    const fetchFn = lookbackMs > CANDLE_SINGLE_FETCH_LIMIT_MS
      ? candlesApi.getCandlesChunked
      : candlesApi.getCandles;

    fetchFn(ticker, { from, to, withAntIndex: true })
      .then(resp => {
        if (cancelled) return;
        setCandles(resp?.points ?? []);
        setCandleError(null);
      })
      .catch(err => {
        if (cancelled) return;
        if (err.status === 401) return;
        setCandleError(formatApiError(err, '캔들 조회 실패'));
      })
      .finally(() => {
        if (!cancelled) setCandleLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedStock?.ticker, isLoggedInUser, candleReloadKey, timeframeMin]);

  // 5분 주기 자동 재요청
  useEffect(() => {
    if (!selectedStock?.ticker || !isLoggedInUser) return;
    const id = setInterval(() => setCandleReloadKey(k => k + 1), CANDLE_REFRESH_MS);
    return () => clearInterval(id);
  }, [selectedStock?.ticker, isLoggedInUser]);

  // ── 최신 개미지수: 진입 시 + 60s 폴링 ─────────────────────────────────
  // 404는 정상 시나리오("데이터 수집 대기중") → 폴링을 즉시 중단해서 콘솔/네트워크
  // 패널 노이즈를 줄인다. 종목을 다시 선택하면 ticker effect가 재구동돼 자동 재시도.
  useEffect(() => {
    const ticker = selectedStock?.ticker;
    if (!ticker || !isLoggedInUser) return;

    let cancelled = false;
    let intervalId = null;
    const stopPolling = () => {
      if (intervalId != null) { clearInterval(intervalId); intervalId = null; }
    };

    const fetchLatest = () => {
      antIndexApi.getLatest(ticker)
        .then(data => {
          if (cancelled) return;
          setAntLatest(data);
          setAntLatestError(null);
        })
        .catch(err => {
          if (cancelled || err.status === 401) return;
          setAntLatest(null);
          setAntLatestError({ status: err.status, message: err.message });
          // 404 / 4xx 클라이언트 에러는 재시도해도 같은 결과 → 폴링 중단
          if (err.status >= 400 && err.status < 500) stopPolling();
        });
    };

    fetchLatest();
    intervalId = setInterval(fetchLatest, ANT_LATEST_POLL_MS);
    return () => { cancelled = true; stopPolling(); };
  }, [selectedStock?.ticker, isLoggedInUser]);

  // ── 개미지수 시계열: 진입 시 + 기간 변경 시 + 5분 주기 동기 갱신 ─────
  // 기간(antPeriod) → ANT_PERIOD_CONFIG 의 lookback/interval 사용.
  // 최신 fetch에서 4xx를 받았으면 시계열도 함께 스킵 (404 요청 절감).
  useEffect(() => {
    const ticker = selectedStock?.ticker;
    if (!ticker || !isLoggedInUser) return;
    if (antLatestError?.status >= 400 && antLatestError?.status < 500) return;

    const cfg = ANT_PERIOD_CONFIG[antPeriod] ?? ANT_PERIOD_CONFIG['24h'];
    let cancelled = false;
    const from = new Date(Date.now() - cfg.lookbackMs);
    antIndexApi.getSeries(ticker, { from, interval: cfg.interval })
      .then(data => {
        if (cancelled) return;
        setAntSeries(data);
      })
      .catch(err => {
        if (cancelled || err.status === 401) return;
        setAntSeries(null);
      });

    return () => { cancelled = true; };
  }, [selectedStock?.ticker, isLoggedInUser, candleReloadKey, antLatestError?.status, antPeriod]);

  // 화면에 표시할 종목 리스트
  //   - 검색어 없음: 시총 Top 100 (DEFAULT_ACTIVE_LIST) — 데모용 안정 풀
  //   - 검색어 있음: 전체 STOCK_CODES 풀에서 매칭 (Top 100 외 종목도 검색 가능)
  //   - whitelistOnly=true: 화이트리스트 55종목으로 필터링 (배지+토글 §B-7)
  const displayList = (() => {
    const q = searchQuery.trim().toLowerCase();
    const base = q
      ? STOCK_CODES.filter(s => s.name.toLowerCase().includes(q) || s.ticker.startsWith(q))
      : DEFAULT_ACTIVE_LIST;
    const filtered = whitelistOnly ? base.filter(s => WHITELIST_SET.has(s.ticker)) : base;
    return q ? filtered.slice(0, 50) : filtered;
  })();

  // 현재 선택 종목이 북마크되어 있는지 확인
  const isBookmarked = selectedStock
    ? bookmarks.some(b => b.ticker === selectedStock.ticker)
    : false;

  // 시간프레임에 맞춰 5분봉 → N분봉으로 클라이언트 집계 (추가 API 호출 없음)
  const aggregatedCandles = useMemo(
    () => aggregateCandles(candles, timeframeMin),
    [candles, timeframeMin]
  );

  // B-7 전략 평가 — 메모이즈
  // 시장 스냅샷 / Claude / Gemini 의견은 ticker 비종속 (모듈 로드 시 캐시).
  const marketSnap = useMemo(() => getMarketSnapshot(), []);
  const claudeOpinion = useMemo(() => getClaudeMarketOpinion(), []);
  const geminiOpinion = useMemo(() => getGeminiMarketOpinion(), []);
  const chatgpt235Eval = useMemo(
    () => strategyDaily.length > 0 ? evaluateChatGPT235(strategyDaily, marketSnap) : null,
    [strategyDaily, marketSnap]
  );
  const antIndexEval = useMemo(
    () => selectedStock?.ticker
      ? evaluateAntIndex(selectedStock.ticker, marketScore, antLatest, voljumpDetail)
      : null,
    [selectedStock?.ticker, marketScore, antLatest, voljumpDetail]
  );

  // antIndex 우선순위 (모두 0~100 스케일, 50=중립):
  //   1) /api/ant-index/{ticker}/latest 응답
  //   2) selectedStock.antIndex (목록 응답 — 데모 시드)
  //   3) /quote 기반 합성 (개미지수 데이터 수집 전 폴백)
  const effectiveAntIndex = useMemo(() => {
    if (antLatest?.score != null) return Number(antLatest.score);
    return deriveAntIndex(selectedStock?.antIndex, quote);
  }, [antLatest, selectedStock?.antIndex, quote]);

  // sentiment 라벨/색상 테마 (POSITIVE=red / NEGATIVE=blue / NEUTRAL=gray, KOR 컨벤션)
  const sentimentTheme = antLatest?.sentiment
    ? SENTIMENT_THEME[antLatest.sentiment]
    : null;

  // 진입 가능 구간 (#6) — 개미모델 시그널 + 현재가 기반 매수/매도 가격대 추정
  const entryZone = useMemo(
    () => calculateEntryZone(effectiveAntIndex, quote?.currentPrice ?? selectedStock?.price ?? null),
    [effectiveAntIndex, quote?.currentPrice, selectedStock?.price]
  );

  // ── 종목 선택 처리 ───────────────────────────────────────────────────
  const handleSelectStock = (stock) => {
    setSelectedStock(stock);
    setIsAlertOn(false);
    setTradeType('BUY');
    setOrderQty(1);
    setOrderToast(null);
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
  // 가격은 /quote 응답 우선, 없으면 selectedStock(목록 응답)에서 폴백.
  const price = quote?.currentPrice ?? selectedStock?.price ?? null;
  // 한국 컨벤션: 하락 파랑 / 상승 빨강
  const isDown = quote ? quote.changeAmount < 0 : false;
  const isFlat = quote ? quote.changeAmount === 0 : false;

  // 0~100 zone 라벨 — api/antIndex.js의 ANT_INDEX_ZONES 단일 출처 재사용
  const getAntLabel = getAntIndexLabel;

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

              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-500" />
                  {searchQuery.trim() ? `"${searchQuery.trim()}" 검색 결과` : '활성 종목'}
                </h3>
                <label className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 cursor-pointer select-none whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={whitelistOnly}
                    onChange={(e) => setWhitelistOnly(e.target.checked)}
                    className="accent-indigo-600"
                  />
                  분석 가능만
                </label>
              </div>

              <div className="flex-1 overflow-y-auto">
                {displayList.length > 0 ? (
                  displayList.map((stock) => (
                    <div
                      key={stock.ticker}
                      className={`flex items-center justify-between px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 transition-colors ${
                        selectedStock?.ticker === stock.ticker ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''
                      }`}
                      onClick={() => handleSelectStock(stock)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {stock.marketCapRank != null && (
                          <span className="w-6 text-xs text-center text-slate-400 font-bold flex-shrink-0">
                            #{stock.marketCapRank}
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-800 truncate">{stock.name}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-1.5">
                            <span>{stock.ticker}</span>
                            {stock.market && (
                              <>
                                <span className="w-0.5 h-0.5 bg-slate-300 rounded-full" />
                                <span>{stock.market}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {WHITELIST_SET.has(stock.ticker) && (
                        <span
                          className="text-[9px] font-bold px-1 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 flex-shrink-0"
                          title="개미지수 분석 지원 종목"
                        >
                          ✓
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-slate-400 text-sm py-8">
                    {searchQuery.trim()
                      ? '검색 결과가 없습니다.'
                      : '활성 종목을 불러오는 중...'}
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
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-800 truncate">{item.name}</div>
                          <div className="text-xs text-slate-400">{item.ticker}</div>
                        </div>
                        {item.market && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                            item.market === 'KOSPI'
                              ? 'bg-blue-50 text-blue-700 border border-blue-100'
                              : 'bg-amber-50 text-amber-700 border border-amber-100'
                          }`}>
                            {item.market}
                          </span>
                        )}
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
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-2xl font-bold text-slate-900">{selectedStock.name}</h1>
                        <span className="text-slate-400 font-medium">{selectedStock.ticker}</span>
                        {selectedStock.market && (
                          <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                            selectedStock.market === 'KOSPI'
                              ? 'bg-blue-50 text-blue-700 border-blue-100'
                              : 'bg-amber-50 text-amber-700 border-amber-100'
                          }`}>
                            {selectedStock.market}
                          </span>
                        )}
                      </div>

                      {/* 실시간 현재가 + 등락 (KOR: 하락 파랑 / 상승 빨강) */}
                      <div className={`text-3xl font-extrabold mt-2 flex items-baseline gap-3 ${
                        isFlat ? 'text-slate-700' : isDown ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        {price != null ? `${price.toLocaleString()}원` : '--'}
                        {quote && (
                          <span className="text-base font-semibold flex items-center">
                            {isDown
                              ? <TrendingDown className="w-4 h-4 mr-1" />
                              : isFlat ? null : <TrendingUp className="w-4 h-4 mr-1" />}
                            {quote.changeAmount > 0 ? '+' : ''}
                            {quote.changeAmount.toLocaleString()} (
                            {quote.changeRate > 0 ? '+' : ''}
                            {quote.changeRate.toFixed(2)}%)
                          </span>
                        )}
                      </div>

                      {/* 메타 + 갱신 시각 + 장중 상태 */}
                      <div className="flex items-center gap-4 text-xs text-slate-500 mt-2 flex-wrap">
                        {selectedStock.sector && <span>섹터: <span className="font-bold text-slate-700">{selectedStock.sector}</span></span>}
                        {selectedStock.marketCapRank != null && <span>시총 순위: <span className="font-bold text-slate-700">#{selectedStock.marketCapRank}</span></span>}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          marketOpen
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {marketOpen ? '● 정규장' : '○ 장마감 (실시간 조회 중지)'}
                        </span>
                        <VoljumpBadge detail={voljumpDetail} status={voljumpStatus} />
                        {quote?.fetchedAt && (
                          <span className="text-slate-400">
                            갱신 {quote.fetchedAt.slice(11, 19)} (KST)
                          </span>
                        )}
                        {quoteError && (
                          <span className="text-red-500 font-medium flex items-center gap-2">
                            {quoteError}
                            {quotePollPaused && (
                              <button
                                onClick={() => setQuoteRetryKey(k => k + 1)}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-colors"
                              >
                                <RefreshCw className="w-3 h-3" />
                                재시도
                              </button>
                            )}
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

                {/* 1. AI 개미 지수 리포트 — effectiveAntIndex(실제값 우선, 없으면 quote 기반 합성) */}
                <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 text-white relative overflow-hidden">
                  <div className="absolute -right-8 -top-8 w-24 h-24 bg-blue-500 rounded-full blur-[40px] opacity-20 pointer-events-none" />
                  <div className="flex items-center gap-2 mb-1">
                    <BrainCircuit className="w-5 h-5 text-indigo-400" />
                    <h2 className="font-bold">개미지수 · 커뮤니티 심리 게이지</h2>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-4">
                    종목토론방 게시글 기반 군중심리 모니터링 — 매매 신호가 아닙니다.
                  </p>

                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 mb-4">
                    <div className="flex justify-between items-end mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs">현재 개미 지수</span>
                        {antLatest?.sentiment && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            antLatest.sentiment === 'POSITIVE' ? 'bg-red-900/40 text-red-300 border-red-800/60'
                            : antLatest.sentiment === 'NEGATIVE' ? 'bg-blue-900/40 text-blue-300 border-blue-800/60'
                            : 'bg-slate-700/40 text-slate-300 border-slate-600/60'
                          }`}>
                            {sentimentTheme?.label ?? antLatest.sentiment}
                          </span>
                        )}
                        {antLatest == null && antLatestError?.status !== 404 && selectedStock?.antIndex == null && (
                          <span className="text-[10px] font-medium text-slate-500">합성 추정치</span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black text-blue-400">
                          {effectiveAntIndex != null ? Number(effectiveAntIndex).toFixed(1) : '--'}
                        </div>
                        <div className="text-[10px] text-slate-400 leading-none">/ 100</div>
                      </div>
                    </div>
                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full"
                        style={{ width: effectiveAntIndex != null ? `${effectiveAntIndex}%` : '50%' }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <p className="text-blue-300 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {getAntLabel(effectiveAntIndex)}
                      </p>
                      {antLatest?.postCount != null && (
                        <span className="text-slate-400">분석 {antLatest.postCount.toLocaleString()}건</span>
                      )}
                    </div>
                  </div>

                  {/* 개미지수 추이 — 기간 선택자 + 정확값 hover. null 구간 끊김. */}
                  <AntIndexTrend
                    series={antSeries}
                    period={antPeriod}
                    onPeriodChange={setAntPeriod}
                  />

                  {/* 404 — 데이터 수집 대기 안내 (점수는 위에서 fallback 표시 유지) */}
                  {antLatestError?.status === 404 && (
                    <div className="text-[11px] text-slate-400 bg-slate-800/40 rounded-lg px-3 py-2 mb-3 border border-slate-700/40">
                      이 종목의 개미지수는 아직 수집 대기 중입니다. 위 점수는 시세 기반 합성 추정치입니다.
                    </div>
                  )}

                  {/* 진입 가능 구간 (요구사항 #6) — 개미모델 시그널 기반 */}
                  <EntryZoneBox zone={entryZone} />
                </div>

                {/* B-7. 전략별 의견 — 캡스톤 백테스트 룰 기반 */}
                <StrategyOpinionsPanel
                  ticker={selectedStock.ticker}
                  chatgpt235={chatgpt235Eval}
                  antIndexEval={antIndexEval}
                  claudeOpinion={claudeOpinion}
                  geminiOpinion={geminiOpinion}
                  loading={strategyLoading}
                  onOpenDetail={setActiveStrategyId}
                />

                {/* 2. 캔들 차트 (5/15/30/60분 선택 — 클라이언트 집계) */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                    <h2 className="text-base font-bold">
                      {timeframeMin < 60 ? `${timeframeMin}분봉` : `${timeframeMin / 60}시간봉`} 차트
                      <span className="text-xs font-normal text-slate-400 ml-2">
                        ({aggregatedCandles.length}개)
                      </span>
                    </h2>
                    <div className="flex items-center gap-2">
                      <div className="flex bg-slate-100 p-0.5 rounded-lg">
                        {[15, 30, 60].map(tf => (
                          <button
                            key={tf}
                            onClick={() => setTimeframeMin(tf)}
                            className={`px-2.5 py-1 text-xs rounded-md font-bold transition-all ${
                              timeframeMin === tf
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            {tf < 60 ? `${tf}m` : `${tf / 60}h`}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setCandleReloadKey(k => k + 1)}
                        disabled={candleLoading}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
                        title="캔들 새로고침"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${candleLoading ? 'animate-spin' : ''}`} />
                        새로고침
                      </button>
                    </div>
                  </div>
                  {candleError ? (
                    <div className="h-48 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center">
                      <p className="text-sm text-red-500 font-medium">{candleError}</p>
                    </div>
                  ) : candleLoading && candles.length === 0 ? (
                    <div className="h-48 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center">
                      <div className="text-center text-slate-400">
                        <Activity className="w-8 h-8 mx-auto mb-2 text-slate-300 animate-pulse" />
                        <p className="text-sm">차트 데이터 로딩 중...</p>
                      </div>
                    </div>
                  ) : (
                    <CandleChart candles={aggregatedCandles} />
                  )}
                  <p className="text-[11px] text-slate-400 mt-2">
                    * 시간프레임마다 적정 조회 기간을 fetch — 15m=3일 · 30m=5일 · 1h=10일.
                    합본 응답에 같은 15분 버킷의 개미지수가 포함되어 시세-여론 정합 분석이 가능합니다.
                  </p>
                </div>

                {/* Model B — 30일 변동성 점프 확률 추이 (P2) */}
                {voljumpHistory && voljumpHistory.points?.length > 0 && (
                  <VoljumpHistoryChart history={voljumpHistory} />
                )}

                {/* 3. 시장 데이터 — /quote 응답 기반 */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <h2 className="font-bold text-sm">시장 데이터</h2>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <InfoCard label="시가"   value={quote?.openPrice != null ? quote.openPrice.toLocaleString() : '--'} />
                    <InfoCard label="고가"   value={quote?.highPrice != null ? quote.highPrice.toLocaleString() : '--'} valueColor="text-red-600" />
                    <InfoCard label="저가"   value={quote?.lowPrice  != null ? quote.lowPrice.toLocaleString()  : '--'} valueColor="text-blue-600" />
                    <InfoCard label="거래량" value={quote?.accVolume != null ? quote.accVolume.toLocaleString() : '--'} />
                  </div>
                </div>

                {/* 4. 모의투자 (시장가 주문) */}
                <MockOrderBox
                  selectedStock={selectedStock}
                  price={price}
                  marketOpen={marketOpen}
                  portfolio={portfolio}
                  tradeType={tradeType}
                  setTradeType={setTradeType}
                  orderQty={orderQty}
                  setOrderQty={setOrderQty}
                  orderToast={orderToast}
                  setOrderToast={setOrderToast}
                  onExecuteOrder={onExecuteOrder}
                  onNavigate={onNavigate}
                />

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
                  커뮤니티 글을 개미지수로 정량화하여 시장 분위기를 보여드립니다.
                </p>

                {/* 최근 검색어 */}
                <div className="w-full max-w-2xl">
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
              </div>

              {/* 랭킹 & 북마크 2열 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* 활성 종목 목록 */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-indigo-500" />
                      활성 종목
                    </h2>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={whitelistOnly}
                        onChange={(e) => setWhitelistOnly(e.target.checked)}
                        className="accent-indigo-600"
                      />
                      분석 가능 종목만 (55개)
                    </label>
                  </div>
                  <div className="space-y-2">
                    {displayList.length > 0 ? (
                      displayList.map((stock) => {
                        const isBm = bookmarks.some(b => b.ticker === stock.ticker);
                        return (
                        <div
                          key={stock.ticker}
                          className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl cursor-pointer group transition-colors"
                          onClick={() => handleSelectStock(stock)}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            {stock.marketCapRank != null && (
                              <span className="w-6 text-center font-bold text-slate-400 text-xs flex-shrink-0">
                                #{stock.marketCapRank}
                              </span>
                            )}
                            <div className="min-w-0">
                              <h3 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors text-sm truncate">
                                {stock.name}
                              </h3>
                              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                                <span>{stock.ticker}</span>
                                {stock.sector && (
                                  <>
                                    <span className="w-0.5 h-0.5 bg-slate-300 rounded-full" />
                                    <span>{stock.sector}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {WHITELIST_SET.has(stock.ticker) && (
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200"
                                title="개미지수 분석 지원 (화이트리스트 55종목)"
                              >
                                ✓ 분석 지원
                              </span>
                            )}
                            {stock.market && (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                stock.market === 'KOSPI' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                              }`}>
                                {stock.market}
                              </span>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); onToggleBookmark(stock); }}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isBm ? 'text-yellow-500 hover:bg-yellow-50' : 'text-slate-300 hover:text-yellow-500 hover:bg-yellow-50'
                              }`}
                              title={isBm ? '북마크 해제' : '북마크 추가'}
                            >
                              <Bookmark className={`w-4 h-4 ${isBm ? 'fill-yellow-500' : ''}`} />
                            </button>
                          </div>
                        </div>
                        );
                      })
                    ) : (
                      <div className="flex flex-col items-center py-8 text-slate-400">
                        <Activity className="w-8 h-8 mb-2 text-slate-300" />
                        <p className="text-sm">
                          {searchQuery.trim()
                            ? '검색 결과가 없습니다.'
                            : '활성 종목을 불러오는 중...'}
                        </p>
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
                          <div className="min-w-0">
                            <h3 className="font-bold text-slate-800 text-sm truncate">{item.name}</h3>
                            <div className="text-xs text-slate-500 flex items-center gap-1.5">
                              <span>{item.ticker}</span>
                              {item.sector && (
                                <>
                                  <span className="w-0.5 h-0.5 bg-slate-300 rounded-full" />
                                  <span className="truncate">{item.sector}</span>
                                </>
                              )}
                            </div>
                          </div>
                          {item.market && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 ml-2 ${
                              item.market === 'KOSPI'
                                ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {item.market}
                            </span>
                          )}
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

      {/* B-7 전략 상세 모달 */}
      {activeStrategyId && (
        <StrategyDetailModal
          id={activeStrategyId}
          ticker={selectedStock?.ticker}
          name={selectedStock?.name}
          chatgpt235={chatgpt235Eval}
          antIndexEval={antIndexEval}
          claudeOpinion={claudeOpinion}
          geminiOpinion={geminiOpinion}
          marketSnap={marketSnap}
          onClose={() => setActiveStrategyId(null)}
        />
      )}
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

// =========================================================================
// EntryZoneBox — 개미모델 시그널 + 현재가 기반 진입 가능 구간 표시 (요구사항 #6)
// zone: { type: 'BUY'|'SELL'|'HOLD', entryLow, entryHigh, stopLoss, target, ... }
// =========================================================================
function EntryZoneBox({ zone }) {
  if (!zone) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 mb-3">
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-200">진입 가능 구간</h3>
        </div>
        <p className="text-xs text-slate-400">시세·개미지수 로딩 후 추정 구간이 표시됩니다.</p>
      </div>
    );
  }

  if (zone.type === 'HOLD') {
    return (
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 mb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-bold text-slate-200">진입 가능 구간</h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-700 text-slate-300 border border-slate-600">관망</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          뚜렷한 비대칭 신호 없음 — 개미모델은 관망을 권장합니다.
          (예상 승률 {zone.winRate}% · 신호 강도 약)
        </p>
      </div>
    );
  }

  const isBuy = zone.type === 'BUY';
  const dirColor = isBuy ? 'text-red-400' : 'text-blue-400';
  const dirBg    = isBuy ? 'bg-red-900/40 border-red-500/40 text-red-300' : 'bg-blue-900/40 border-blue-500/40 text-blue-300';
  const dirLabel = isBuy ? '매수' : '차익실현';

  return (
    <div className={`rounded-xl p-4 border mb-3 ${isBuy ? 'bg-red-950/30 border-red-800/40' : 'bg-blue-950/30 border-blue-800/40'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className={`w-4 h-4 ${dirColor}`} />
          <h3 className="text-sm font-bold text-slate-100">진입 가능 구간</h3>
        </div>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${dirBg}`}>
          개미모델 · {dirLabel}
        </span>
      </div>

      {/* 가격대 — 진입 / 목표 / 손절 */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <PriceCell label="진입가" value={`${zone.entryLow.toLocaleString()} ~`} subtitle={`${zone.entryHigh.toLocaleString()}원`} accent="text-slate-100" />
        <PriceCell
          label={isBuy ? '목표가' : '하락 목표가'}
          value={`${zone.target.toLocaleString()}원`}
          subtitle={`${isBuy ? '+' : '-'}${zone.targetPct}%`}
          accent={isBuy ? 'text-red-300' : 'text-blue-300'}
        />
        <PriceCell
          label="손절가"
          value={`${zone.stopLoss.toLocaleString()}원`}
          subtitle={`${isBuy ? '-' : '+'}${zone.stopPct}%`}
          accent="text-amber-300"
        />
      </div>

      {/* 모델 메트릭 */}
      <div className="flex items-center justify-between text-[11px] text-slate-300 px-1">
        <div className="flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5 text-emerald-400" /> 예측 승률 <b className="text-white">{zone.winRate}%</b></div>
        <div className="flex items-center gap-1.5"><Percent className="w-3.5 h-3.5 text-sky-400" /> 기대 수익 <b className="text-white">{isBuy ? '+' : '-'}{zone.targetPct}%</b></div>
        <div className="flex items-center gap-1.5"><Timer className="w-3.5 h-3.5 text-violet-400" /> 홀딩 <b className="text-white">{zone.holdingDays}일</b></div>
      </div>
    </div>
  );
}

function PriceCell({ label, value, subtitle, accent = 'text-white' }) {
  return (
    <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-700/40">
      <div className="text-[10px] font-bold text-slate-400 uppercase">{label}</div>
      <div className={`text-sm font-extrabold leading-tight ${accent}`}>{value}</div>
      {subtitle && <div className="text-[10px] text-slate-400 mt-0.5">{subtitle}</div>}
    </div>
  );
}

// =========================================================================
// B-7 StrategyOpinionsPanel — 종목 상세에 표시되는 4개 전략 의견 카드
//
// 카드:
//   1) AntModel — zone × 화이트리스트 (per-stock)
//   2) ChatGPT(235) — 5조건 룰 평가 (per-stock)
//   3) Claude(축약) — 시장 비중 룰 (per-stock 의견 없음, 시장 카드)
//   4) Gemini — 시장 비중 룰 (per-stock 의견 없음, 시장 카드)
// =========================================================================
function StrategyOpinionsPanel({
  ticker, chatgpt235, antIndexEval, claudeOpinion, geminiOpinion, loading, onOpenDetail,
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Trophy className="w-5 h-5 text-amber-500" />
        <h2 className="font-bold text-slate-900">전략별 의견</h2>
      </div>
      <p className="text-[11px] text-slate-500 mb-4">
        캡스톤 백테스트 원본 룰을 동일 기간·동일 비용으로 평가한 결과입니다. 매매 추천이 아닙니다.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* AntModel — 의견 제공 = 종목 개미지수 데이터 존재 여부.
            voljump severity=HIGH 면 신규 진입 회피로 비중 0% 오버라이드 (exclude_voljump_alert). */}
        <StrategyCardMini
          color="#4f46e5"
          name="AntModel (개미지수)"
          signal={
            antIndexEval?.hasData === false ? 'OUT'
            : antIndexEval?.voljumpExcluded ? 'ALERT'
            : antIndexEval?.recommendedWeight != null ? 'WEIGHT'
            : 'UNKNOWN'
          }
          signalText={
            antIndexEval?.hasData === false ? '데이터 수집 대기'
            : antIndexEval?.voljumpExcluded
              ? `변동성 경보 — 비중 0%${antIndexEval.baseWeight != null ? ` (원본 ${Math.round(antIndexEval.baseWeight * 100)}%)` : ''}`
              : antIndexEval?.recommendedWeight != null
                ? `비중 ${Math.round(antIndexEval.recommendedWeight * 100)}%`
                : '집계 중'
          }
          metric={
            antIndexEval?.tickerScore != null
              ? `종목 ${antIndexEval.tickerScore.toFixed(1)} · 시장 ${antIndexEval.zone?.label ?? '—'}`
              : (antIndexEval?.zone?.label ?? '—')
          }
          subtitle={antIndexEval?.reason}
          onOpen={() => onOpenDetail('ant_index_strategy')}
        />

        {/* ChatGPT */}
        <StrategyCardMini
          color="#10b981"
          name="ChatGPT 룰"
          signal={chatgpt235?.signal ?? 'LOADING'}
          signalText={chatgpt235?.signal === 'BUY' ? '진입 후보' : chatgpt235?.signal === 'HOLD' ? '진입 조건 미충족' : '평가 중'}
          metric={chatgpt235 ? `${chatgpt235.passedCount}/${chatgpt235.totalCount} 조건 충족` : (loading ? '평가 중...' : '데이터 부족')}
          subtitle="5개 조건 체크리스트는 자세히 보기에서 확인"
          onOpen={() => onOpenDetail('chatgpt_235')}
        />

        {/* Claude */}
        <StrategyCardMini
          color="#f59e0b"
          name="Claude 룰"
          signal={'MARKET'}
          signalText={`시장 비중 ${Math.round((claudeOpinion?.allocation ?? 0) * 100)}%`}
          metric="이 종목 단독 의견 없음 (시장 비중 룰)"
          subtitle={claudeOpinion?.reason}
          onOpen={() => onOpenDetail('claude_compact')}
        />

        {/* Gemini */}
        <StrategyCardMini
          color="#0ea5e9"
          name="Gemini 룰"
          signal={'MARKET'}
          signalText={geminiOpinion?.position === 'ENTRY' ? '진입 가능 (시장)' : '현금 (시장)'}
          metric="이 종목 단독 의견 없음 (시장 비중 룰)"
          subtitle={geminiOpinion?.reason}
          onOpen={() => onOpenDetail('gemini')}
        />
      </div>

      <p className="text-[10px] text-slate-400 mt-4 leading-relaxed">
        * 실제 LLM 이 추천한 것이 아니라 캡스톤 답변을 룰화한 평가입니다.
        외국인 데이터를 사용하는 ChatGPT-Full(55) 룰은 BE API 부재로 본 화면에 미노출 (B-6 차트는 비교 가능).
      </p>
    </div>
  );
}

function StrategyCardMini({ color, name, signal, signalText, metric, subtitle, onOpen }) {
  const chipCfg = {
    BUY:     { bg: 'bg-red-100 text-red-700 border-red-200', label: 'BUY' },
    HOLD:    { bg: 'bg-slate-100 text-slate-600 border-slate-200', label: 'HOLD' },
    OUT:     { bg: 'bg-slate-100 text-slate-500 border-slate-200', label: 'OUT' },
    WEIGHT:  { bg: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: '비중' },
    MARKET:  { bg: 'bg-amber-100 text-amber-700 border-amber-200', label: '시장' },
    ALERT:   { bg: 'bg-red-100 text-red-700 border-red-200', label: '경보' },
    LOADING: { bg: 'bg-slate-100 text-slate-400 border-slate-200', label: '...' },
    UNKNOWN: { bg: 'bg-slate-100 text-slate-400 border-slate-200', label: '—' },
  }[signal] ?? { bg: 'bg-slate-100 text-slate-400 border-slate-200', label: '—' };

  return (
    <button
      onClick={onOpen}
      className="text-left bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm rounded-xl p-3 transition-all flex flex-col gap-1.5"
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="font-bold text-sm text-slate-900 truncate">{name}</span>
        </div>
        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border flex-shrink-0 ${chipCfg.bg}`}>
          {chipCfg.label}
        </span>
      </div>
      <div className="text-sm font-bold text-slate-800">{signalText}</div>
      <div className="text-[11px] text-slate-500">{metric}</div>
      {subtitle && (
        <div className="text-[10px] text-slate-400 truncate" title={subtitle}>{subtitle}</div>
      )}
      <div className="text-[10px] text-indigo-500 font-bold mt-1">자세히 보기 →</div>
    </button>
  );
}

// =========================================================================
// B-7 StrategyDetailModal — 전략별 평가 상세 모달
// id: 'ant_index_strategy' | 'chatgpt_235' | 'claude_compact' | 'gemini'
// =========================================================================
// B-7 모달용 단순 표시 이름 (universe / 축약 같은 노이즈 제거)
const STRATEGY_DISPLAY_NAME = {
  ant_index_strategy: '개미지수 디리스킹',
  chatgpt_235:        'ChatGPT 룰',
  chatgpt_full_55:    'ChatGPT 룰 (55 universe)',
  claude_compact:     'Claude 룰',
  gemini:             'Gemini 룰',
  buy_and_hold:       'Buy & Hold',
};

function StrategyDetailModal({
  id, ticker, name, chatgpt235, antIndexEval, claudeOpinion, geminiOpinion, marketSnap, onClose,
}) {
  const rule = LLM_RULES[id];
  if (!rule) return null;
  const displayName = STRATEGY_DISPLAY_NAME[id] ?? rule.name;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-slate-900">{displayName}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {name ? `${name} (${ticker})` : ticker} · 출처: {rule.source}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-5">
          {/* 룰 description */}
          <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 leading-relaxed">
            {rule.description}
          </section>

          {/* 전략별 평가 본문 */}
          {id === 'chatgpt_235' && (
            <ChatGPT235Detail evalResult={chatgpt235} />
          )}
          {id === 'ant_index_strategy' && (
            <AntIndexDetail evalResult={antIndexEval} rule={rule} />
          )}
          {id === 'claude_compact' && (
            <MarketOpinionDetail
              title="현재 시장 의견"
              primary={`주식 비중 ${Math.round((claudeOpinion?.allocation ?? 0) * 100)}%`}
              reason={claudeOpinion?.reason}
              extra={[
                { label: 'VKOSPI 프록시 (20일 RV)', value: claudeOpinion?.vkospi != null ? `${(claudeOpinion.vkospi * 100).toFixed(1)}%/년` : '—' },
                { label: '12개월 시장 수익률', value: claudeOpinion?.mom12m != null ? `${(claudeOpinion.mom12m * 100).toFixed(1)}%` : '—' },
                { label: '시장 데이터 기준일', value: marketSnap?.asOf ?? '—' },
              ]}
              note="이 종목 단독 의견 없음 — Claude(축약)은 시장 비중 룰입니다."
            />
          )}
          {id === 'gemini' && (
            <MarketOpinionDetail
              title="현재 시장 의견"
              primary={geminiOpinion?.position === 'ENTRY' ? '진입 가능' : '현금 보유'}
              reason={geminiOpinion?.reason}
              extra={[
                { label: '구름(9/26/52 평균) 위', value: geminiOpinion?.aboveCloud == null ? '—' : geminiOpinion.aboveCloud ? '예' : '아니오' },
                { label: 'VKOSPI 프록시', value: geminiOpinion?.vkospi != null ? `${(geminiOpinion.vkospi * 100).toFixed(1)}%/년` : '—' },
                { label: '시장 데이터 기준일', value: marketSnap?.asOf ?? '—' },
              ]}
              note="이 종목 단독 의견 없음 — Gemini 는 시장 비중 룰입니다."
            />
          )}

          {/* 면책 */}
          <section className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-amber-800 leading-relaxed">
              본 평가는 캡스톤 백테스트 원본 룰을 동일 비용·기간으로 단순화 이식한 결과입니다.
              실제 LLM 추천이 아니며, 단일종목 평가에선 cross-section 컷오프(상위 20% / 하위 90%)를 절대 임계값으로 근사했습니다.
              백테스트 누적수익률 비교는 "LLM 전략 비교" 탭을 참조하세요.
            </p>
          </section>
        </div>

        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-sm font-bold bg-slate-900 text-white hover:bg-slate-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatGPT235Detail({ evalResult }) {
  if (!evalResult) {
    return <p className="text-sm text-slate-400">평가 데이터 부족.</p>;
  }
  return (
    <section>
      <h3 className="text-sm font-bold text-slate-900 mb-2">5조건 체크리스트</h3>
      <ul className="space-y-2">
        {evalResult.conditions.map(c => (
          <li
            key={c.id}
            className={`flex items-start gap-3 p-3 rounded-lg border ${
              c.passed === true ? 'bg-emerald-50 border-emerald-200'
              : c.passed === false ? 'bg-slate-50 border-slate-200'
              : 'bg-slate-50 border-slate-200 opacity-60'
            }`}
          >
            <span className={`text-base font-black flex-shrink-0 ${
              c.passed === true ? 'text-emerald-600'
              : c.passed === false ? 'text-slate-400'
              : 'text-slate-300'
            }`}>
              {c.passed === true ? '✓' : c.passed === false ? '✗' : '—'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm text-slate-800">{c.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                현재값: <b className="text-slate-700">{c.value}</b> · 기준: {c.threshold}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 text-center">
        <span className={`inline-block text-xs font-black px-3 py-1 rounded-full ${
          evalResult.signal === 'BUY' ? 'bg-red-100 text-red-700 border border-red-200'
          : 'bg-slate-100 text-slate-600 border border-slate-200'
        }`}>
          최종 시그널: {evalResult.signal} ({evalResult.passedCount}/{evalResult.totalCount} 충족)
        </span>
      </div>
    </section>
  );
}

function AntIndexDetail({ evalResult, rule }) {
  if (!evalResult) return null;
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">종목 개미지수</div>
          <div className={`text-base font-black ${evalResult.tickerZone?.text ?? 'text-slate-400'}`}>
            {evalResult.tickerScore != null ? evalResult.tickerScore.toFixed(1) : '데이터 없음'}
          </div>
          {evalResult.tickerZone && (
            <div className="text-[10px] text-slate-500 mt-0.5">{evalResult.tickerZone.label}</div>
          )}
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">시장 zone</div>
          <div className={`text-base font-black ${evalResult.zone.text}`}>{evalResult.zone.label}</div>
          {evalResult.baseWeight != null && (
            <div className="text-[10px] text-slate-500 mt-0.5">원본 비중 {Math.round(evalResult.baseWeight * 100)}%</div>
          )}
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">백테스트 universe</div>
          <div className={`text-base font-black ${evalResult.inBacktestUniverse ? 'text-emerald-600' : 'text-slate-500'}`}>
            {evalResult.inBacktestUniverse ? '✓ 55 포함' : '외 종목'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {evalResult.inBacktestUniverse ? '백테스트 결과 직접 적용' : '비중 가이드만 적용'}
          </div>
        </div>
      </div>

      {/* voljump 오버라이드 시 강조 박스 */}
      {evalResult.voljumpExcluded && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-red-800 leading-relaxed">
            <b>변동성 점프 경보 HIGH 발동</b> — 캡스톤 §5 룰
            (<code className="bg-red-100 px-1 rounded">exclude_voljump_alert</code>)
            에 따라 신규 진입 비중을 <b>0%</b> 로 오버라이드합니다.
            기존 보유 시 익절·관망 결정은 별도 판단 필요.
          </div>
        </div>
      )}
      {!evalResult.voljumpExcluded && evalResult.voljumpSeverity === 'MEDIUM' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          변동성 점프 경보 MEDIUM — 비중은 유지하되 신규 진입에 주의하세요.
        </div>
      )}

      <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 leading-relaxed">
        {evalResult.reason}
      </div>
      {rule?.rules?.weight_by_zone && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-bold text-slate-500 uppercase">Zone → 권장 주식 비중</div>
            {evalResult.recommendedWeight != null && (
              <div className="text-[10px] text-slate-600">
                최종 적용:
                <b className={`ml-1 ${evalResult.voljumpExcluded ? 'text-red-600' : 'text-indigo-700'}`}>
                  {Math.round(evalResult.recommendedWeight * 100)}%
                </b>
                {evalResult.voljumpExcluded && evalResult.baseWeight != null && (
                  <span className="text-slate-400 line-through ml-1">{Math.round(evalResult.baseWeight * 100)}%</span>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            {Object.entries(rule.rules.weight_by_zone).map(([zone, w]) => (
              <div key={zone} className={evalResult.zone.label === zone ? 'font-black bg-indigo-50 rounded p-1 -m-1' : ''}>
                <div className="text-slate-600">{zone}</div>
                <div className="text-lg text-slate-900 mt-0.5">{Math.round(w * 100)}%</div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-slate-400 mt-2 text-center">
            ※ 현재 시장 zone 강조. voljump HIGH 시 최종 적용 0%.
          </div>
        </div>
      )}
    </section>
  );
}

// =========================================================================
// VoljumpBadge — 종목 상세 헤더의 변동성 점프 경보 배지
//   - 404 또는 미연동(detail=null && status===null) 시 숨김 (화이트리스트 외 등)
//   - status=VALID + severity 매핑 → SEVERITY_THEME
//   - status≠VALID → 회색 + 툴팁
// =========================================================================
function VoljumpBadge({ detail, status }) {
  // 404 or fetch 실패 시 배지 미표시
  if (!detail && status === 404) return null;
  if (!detail) return null;

  const isValid = detail.status === 'VALID';
  const theme = isValid && detail.severity
    ? SEVERITY_THEME[detail.severity] ?? STATUS_FALLBACK_THEME
    : STATUS_FALLBACK_THEME;
  const labelText = isValid
    ? `변동성 경보 ${detail.severity} · ${fmtJumpProb(detail.jumpProb)}`
    : `변동성 데이터 ${STATUS_TOOLTIP[detail.status] ?? '비유효'}`;

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${theme.chip}`}
      title={
        isValid
          ? `다음 영업일에 일일 변동성이 평소보다 크게 튈 확률 ${fmtJumpProb(detail.jumpProb)} (${detail.baseDay} 기준). 매매 추천 아님.`
          : STATUS_TOOLTIP[detail.status] ?? '데이터 비유효'
      }
    >
      {labelText}
    </span>
  );
}

// =========================================================================
// VoljumpHistoryChart — 종목 30일 변동성 점프 확률 추이 (인라인 SVG)
//   - Y축: jump_prob (0~1)
//   - 0.2 / 0.4 임계선 가이드
//   - status='VALID' = 정상색, 그 외 = 회색
//   - 주말·휴일 누락 → 응답 그대로 시퀀스로 그림 (영업일만 X축)
// =========================================================================
function VoljumpHistoryChart({ history }) {
  const points = history?.points;
  if (!points || points.length === 0) return null;

  const W = 720, H = 160, PAD_L = 44, PAD_R = 12, PAD_T = 12, PAD_B = 24;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const n = points.length;
  const xOf = (i) => PAD_L + (innerW * i) / Math.max(1, n - 1);
  const yOf = (v) => PAD_T + (1 - v) * innerH;  // 0~1 직접 매핑

  // 라인 경로 — null 구간 끊기
  let d = '';
  let prevValid = false;
  points.forEach((p, i) => {
    if (p.jumpProb == null) { prevValid = false; return; }
    const cmd = prevValid ? 'L' : 'M';
    d += `${cmd}${xOf(i).toFixed(2)},${yOf(p.jumpProb).toFixed(2)} `;
    prevValid = true;
  });

  // 라벨: 5개만
  const labelStep = Math.max(1, Math.floor(n / 5));
  const xLabels = points
    .map((p, i) => ({ i, date: p.baseDay }))
    .filter(({ i }) => i % labelStep === 0);

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h2 className="font-bold text-slate-900 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-500" />
          변동성 점프 확률 추이 (최근 {n}영업일)
        </h2>
        <span className="text-[10px] text-slate-400">
          0.4 이상 HIGH · 0.2~0.4 MEDIUM · 그 외 안정
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: 160 }}>
        {/* y 그리드 + 임계선 */}
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => (
          <g key={t}>
            <line
              x1={PAD_L} x2={W - PAD_R} y1={yOf(t)} y2={yOf(t)}
              stroke={t === 0.4 ? '#dc2626' : t === 0.2 ? '#d97706' : '#e2e8f0'}
              strokeWidth="1"
              strokeDasharray={t === 0.4 || t === 0.2 ? '4,3' : ''}
            />
            <text x={PAD_L - 6} y={yOf(t)} fontSize="10" fill="#94a3b8" textAnchor="end" dominantBaseline="middle">
              {(t * 100).toFixed(0)}%
            </text>
          </g>
        ))}
        {/* 라인 */}
        <path d={d} fill="none" stroke="#0ea5e9" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        {/* 점 (status별 색) */}
        {points.map((p, i) => {
          if (p.jumpProb == null) return null;
          const isValid = p.status === 'VALID';
          const fill = !isValid ? '#94a3b8'
            : p.jumpProb >= 0.4 ? '#dc2626'
            : p.jumpProb >= 0.2 ? '#d97706'
            : '#64748b';
          return (
            <circle key={i} cx={xOf(i)} cy={yOf(p.jumpProb)} r={p.jumpProb >= 0.4 ? 3 : 2} fill={fill}>
              <title>{`${p.baseDay} · ${(p.jumpProb * 100).toFixed(2)}% · ${p.status}`}</title>
            </circle>
          );
        })}
        {/* x 라벨 */}
        {xLabels.map(({ i, date }) => (
          <text key={i} x={xOf(i)} y={H - 8} fontSize="9" fill="#94a3b8" textAnchor="middle">
            {date?.slice(5)}
          </text>
        ))}
      </svg>
      <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
        다음 영업일에 일일 변동성이 평소보다 크게 튈 확률입니다. 매매 추천이 아닙니다.
        주말·휴일은 X축에서 자연 제외됩니다.
      </p>
    </div>
  );
}

// =========================================================================
// MockOrderBox — 종목 상세 시장가 주문 박스
//   - 매수/매도 탭, 수량 입력
//   - 시장가 = 현재 quote.currentPrice (없으면 비활성화)
//   - 장마감 후엔 "장마감가 기준" 라벨 + 마지막 quote 사용 (App.js executeOrder)
//   - 매수: 현금 확인 / 매도: 보유 수량 확인
//   - 수수료 0.015% + 매도세 0.20% 자동 적용
// =========================================================================
function MockOrderBox({
  selectedStock, price, marketOpen, portfolio,
  tradeType, setTradeType, orderQty, setOrderQty,
  orderToast, setOrderToast, onExecuteOrder, onNavigate,
}) {
  const ticker = selectedStock?.ticker;
  const heldQty = portfolio?.holdings?.[ticker]?.quantity ?? 0;
  const cash    = portfolio?.cash ?? 0;
  const qty = Math.max(1, Math.floor(Number(orderQty) || 1));

  // 예상 비용/수령액
  const gross = price != null ? price * qty : null;
  const fee   = gross != null ? gross * MOCK_FEE_RATE : null;
  const tax   = gross != null && tradeType === 'SELL' ? gross * MOCK_TAX_RATE_SELL : 0;
  const totalCost   = tradeType === 'BUY'  && gross != null ? gross + fee : null;
  const totalCredit = tradeType === 'SELL' && gross != null ? gross - fee - tax : null;

  // 최대 가능 수량
  const maxBuyQty  = price != null && price > 0 ? Math.floor(cash / (price * (1 + MOCK_FEE_RATE))) : 0;
  const maxSellQty = heldQty;
  const maxQty     = tradeType === 'BUY' ? maxBuyQty : maxSellQty;

  // 검증
  const reason = !price ? '시세 정보 없음'
    : tradeType === 'BUY' && totalCost > cash ? '현금 부족'
    : tradeType === 'SELL' && qty > heldQty ? '보유 수량 부족'
    : null;
  const canSubmit = !reason && qty > 0 && !!onExecuteOrder;

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (!window.confirm(
      `[${tradeType === 'BUY' ? '매수' : '매도'}] ${selectedStock.name} ${qty}주\n` +
      `시장가: ${Math.round(price).toLocaleString()}원\n` +
      `${tradeType === 'BUY' ? '총 지출' : '순 수령'}: ${Math.round(tradeType === 'BUY' ? totalCost : totalCredit).toLocaleString()}원\n\n` +
      `진행하시겠습니까?`
    )) return;
    const result = onExecuteOrder({
      ticker: selectedStock.ticker,
      name:   selectedStock.name,
      type:   tradeType,
      quantity: qty,
      price,
    });
    if (result?.ok) {
      setOrderToast({
        type: 'success',
        message: `${tradeType === 'BUY' ? '매수' : '매도'} 체결 ${qty}주 × ${Math.round(price).toLocaleString()}원`,
      });
      setOrderQty(1);
    } else {
      setOrderToast({ type: 'error', message: result?.error ?? '주문 실패' });
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <ShoppingCart className="w-5 h-5 text-slate-800" />
        <h2 className="font-bold text-slate-900">모의투자 (시장가)</h2>
        {!marketOpen && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 ml-auto">
            장마감가 기준
          </span>
        )}
      </div>

      {/* 매수/매도 탭 */}
      <div className="flex bg-slate-100 p-1 rounded-xl mb-3">
        <button
          onClick={() => { setTradeType('BUY'); setOrderToast(null); }}
          className={`flex-1 py-1.5 rounded-lg font-bold text-sm transition-all ${
            tradeType === 'BUY' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'
          }`}
        >매수</button>
        <button
          onClick={() => { setTradeType('SELL'); setOrderToast(null); }}
          className={`flex-1 py-1.5 rounded-lg font-bold text-sm transition-all ${
            tradeType === 'SELL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
          }`}
        >매도</button>
      </div>

      {/* 현재가 */}
      <div className="mb-2">
        <label className="text-xs font-bold text-slate-500 block mb-1">주문 단가 (시장가)</label>
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-700 text-right text-sm cursor-not-allowed">
          {price != null ? `${Math.round(price).toLocaleString()} 원` : '-- 원'}
        </div>
      </div>

      {/* 수량 */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-bold text-slate-500">주문 수량</label>
          <button
            onClick={() => setOrderQty(maxQty > 0 ? maxQty : 1)}
            className="text-[10px] text-indigo-600 font-bold hover:underline"
            disabled={maxQty <= 0}
          >
            최대 {maxQty.toLocaleString()}주
          </button>
        </div>
        <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden">
          <button
            onClick={() => setOrderQty(q => Math.max(1, Number(q) - 1))}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border-r border-slate-300"
          >
            <Minus className="w-4 h-4" />
          </button>
          <input
            type="number"
            value={orderQty}
            onChange={(e) => setOrderQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            className="w-full text-center font-bold text-base border-none outline-none bg-white"
            min="1"
          />
          <button
            onClick={() => setOrderQty(q => Number(q) + 1)}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border-l border-slate-300"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 예상 금액 + 컨텍스트 */}
      <div className="py-2 border-t border-slate-100 mb-3 space-y-1 text-xs">
        <div className="flex justify-between text-slate-500">
          <span>약정금액 (수량 × 시장가)</span>
          <span className="font-medium text-slate-700">
            {gross != null ? `${Math.round(gross).toLocaleString()}원` : '— 원'}
          </span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>수수료 {(MOCK_FEE_RATE * 100).toFixed(3)}%{tradeType === 'SELL' ? ` + 세 ${(MOCK_TAX_RATE_SELL * 100).toFixed(2)}%` : ''}</span>
          <span>{fee != null ? `-${Math.round(fee + tax).toLocaleString()}원` : '—'}</span>
        </div>
        <div className="flex justify-between items-center pt-1 border-t border-slate-100">
          <span className="text-sm text-slate-700 font-medium">
            {tradeType === 'BUY' ? '총 지출' : '순 수령'}
          </span>
          <span className={`font-black text-base ${tradeType === 'BUY' ? 'text-red-600' : 'text-blue-600'}`}>
            {tradeType === 'BUY'
              ? (totalCost != null ? `${Math.round(totalCost).toLocaleString()}원` : '— 원')
              : (totalCredit != null ? `${Math.round(totalCredit).toLocaleString()}원` : '— 원')}
          </span>
        </div>
        <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
          {tradeType === 'BUY' ? (
            <>
              <span>가용 현금</span>
              <span>{Math.round(cash).toLocaleString()}원</span>
            </>
          ) : (
            <>
              <span>보유 수량</span>
              <span>{heldQty.toLocaleString()}주</span>
            </>
          )}
        </div>
      </div>

      {/* 토스트 */}
      {orderToast && (
        <div className={`mb-3 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${
          orderToast.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {orderToast.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          <span className="flex-1">{orderToast.message}</span>
          <button
            onClick={() => setOrderToast(null)}
            className="text-current opacity-50 hover:opacity-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 주문 버튼 */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`w-full py-3 rounded-xl font-bold text-white text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
          tradeType === 'BUY'
            ? 'bg-red-500 hover:bg-red-600'
            : 'bg-blue-500 hover:bg-blue-600'
        }`}
      >
        {reason
          ? reason
          : `시장가 ${tradeType === 'BUY' ? '매수' : '매도'} ${qty}주`}
      </button>
      <button
        onClick={() => onNavigate('mock-invest')}
        className="w-full mt-2 text-[11px] text-slate-500 hover:text-slate-800"
      >
        포트폴리오 보기 →
      </button>
      <p className="text-center text-[10px] text-slate-400 mt-1.5">
        가상 자금 시뮬레이션. 본 기기 localStorage 에만 저장됩니다.
      </p>
    </div>
  );
}

function MarketOpinionDetail({ title, primary, reason, extra, note }) {
  return (
    <section className="space-y-3">
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">{title}</div>
        <div className="text-xl font-black text-slate-900">{primary}</div>
        {reason && <div className="text-xs text-slate-600 mt-1">{reason}</div>}
      </div>
      {extra?.length > 0 && (
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          {extra.map((e, i) => (
            <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-2">
              <div className="text-[10px] font-bold text-slate-500 uppercase">{e.label}</div>
              <div className="font-bold text-slate-800 mt-1">{e.value}</div>
            </div>
          ))}
        </div>
      )}
      {note && (
        <p className="text-[11px] text-slate-500">{note}</p>
      )}
    </section>
  );
}

// =========================================================================
// AntIndexTrend — 개미지수 추이 라인 차트 (기간 선택 + 정확값 hover)
//
// series: { ticker, interval, points: [{ timestamp, score, sentiment, postCount }] }
// 표시 요소:
//   - 기간 선택자 (24h / 7d / 30d)
//   - Y축: 0~100, 라벨 (0/25/50/75/100) + zone 경계선 (25/45/55/75)
//   - X축: 시간/날짜 라벨 (period 별 포맷 다름)
//   - 라인: null 구간 끊어서. 마지막 유효점 sentiment 색상.
//   - 각 valid 점에 <circle> + <title> → 브라우저 네이티브 hover 툴팁
//     (정확 timestamp / score / sentiment / 게시글 수 표시)
// =========================================================================
const ANT_PERIODS_FOR_SELECTOR = [
  { id: '24h', label: '24h' },
  { id: '7d',  label: '7일' },
  { id: '30d', label: '30일' },
];

function AntIndexTrend({ series, period = '24h', onPeriodChange }) {
  const points = series?.points ?? [];
  const hasData = points.length > 0;

  const W = 720, H = 200, PAD_L = 36, PAD_R = 12, PAD_T = 10, PAD_B = 26;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const n = points.length;
  const xOf = (i) => PAD_L + (innerW * i) / Math.max(1, n - 1);
  const yOf = (v) => PAD_T + (1 - v / 100) * innerH;

  // 라인 경로 + null 끊기
  let d = '';
  let prevValid = false;
  points.forEach((p, i) => {
    if (p.score == null) { prevValid = false; return; }
    const x = xOf(i);
    const y = yOf(Number(p.score));
    d += `${prevValid ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)} `;
    prevValid = true;
  });

  const lastValid = [...points].reverse().find(p => p.score != null);
  const stroke = lastValid?.sentiment
    ? (SENTIMENT_THEME[lastValid.sentiment]?.stroke ?? '#94a3b8')
    : '#94a3b8';

  // x 라벨 6개. period 별 포맷 다르게 (24h=HH:MM, 7d/30d=MM-DD).
  const labelCount = Math.min(6, n);
  const labelStep = Math.max(1, Math.floor(n / labelCount));
  const formatXLabel = (ts) => {
    if (!ts) return '';
    if (period === '24h') return ts.slice(11, 16);  // HH:MM
    return ts.slice(5, 10);                          // MM-DD
  };
  const xLabels = points
    .map((p, i) => ({ i, ts: p.timestamp }))
    .filter(({ i }) => i % labelStep === 0)
    .slice(0, labelCount);

  // y 라벨
  const yTicks = [0, 25, 50, 75, 100];

  // 마지막 유효 값 강조 표시 (오른쪽 상단 큰 숫자)
  const headerValue = lastValid?.score != null ? Number(lastValid.score).toFixed(1) : '—';
  const headerSentiment = lastValid?.sentiment ?? null;

  return (
    <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/40 mb-3">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-300">개미지수 추이</span>
          {series?.interval && (
            <span className="text-[10px] text-slate-500">· {series.interval} · {n}개</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* 최신값 강조 */}
          {hasData && (
            <span className="text-[11px] text-slate-400">
              최신&nbsp;
              <b className={
                headerSentiment === 'POSITIVE' ? 'text-red-400'
                : headerSentiment === 'NEGATIVE' ? 'text-blue-400'
                : 'text-slate-200'
              }>
                {headerValue}
              </b>
            </span>
          )}
          {/* 기간 선택 */}
          {onPeriodChange && (
            <div className="inline-flex bg-slate-900/60 p-0.5 rounded">
              {ANT_PERIODS_FOR_SELECTOR.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => onPeriodChange(opt.id)}
                  className={`px-2 py-0.5 text-[10px] rounded font-bold transition-all ${
                    period === opt.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {!hasData ? (
        <div className="h-32 flex items-center justify-center">
          <p className="text-[11px] text-slate-500">선택한 기간에 개미지수 데이터가 없습니다.</p>
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: 200 }}>
          {/* zone 배경 밴드 (5단계 — 약하게) */}
          <rect x={PAD_L} y={yOf(100)} width={innerW} height={yOf(75) - yOf(100)} fill="#7f1d1d" opacity="0.15" />
          <rect x={PAD_L} y={yOf(75)}  width={innerW} height={yOf(55) - yOf(75)}  fill="#c2410c" opacity="0.10" />
          <rect x={PAD_L} y={yOf(55)}  width={innerW} height={yOf(45) - yOf(55)}  fill="#a16207" opacity="0.10" />
          <rect x={PAD_L} y={yOf(45)}  width={innerW} height={yOf(25) - yOf(45)}  fill="#0369a1" opacity="0.10" />
          <rect x={PAD_L} y={yOf(25)}  width={innerW} height={yOf(0)  - yOf(25)}  fill="#1e40af" opacity="0.15" />

          {/* y 그리드 + 라벨 (0/25/50/75/100) */}
          {yTicks.map(t => (
            <g key={t}>
              <line
                x1={PAD_L} x2={W - PAD_R}
                y1={yOf(t)} y2={yOf(t)}
                stroke={t === 50 ? '#64748b' : '#334155'}
                strokeWidth="1"
                strokeDasharray={t === 50 ? '4,3' : ''}
              />
              <text x={PAD_L - 4} y={yOf(t)} fontSize="9" fill="#94a3b8" textAnchor="end" dominantBaseline="middle">
                {t}
              </text>
            </g>
          ))}

          {/* zone 경계선 (25/45/55/75) 점선 */}
          {[25, 45, 55, 75].map(t => (
            <line
              key={`b${t}`}
              x1={PAD_L} x2={W - PAD_R}
              y1={yOf(t)} y2={yOf(t)}
              stroke="#475569" strokeWidth="0.5" strokeDasharray="2,4"
              opacity="0.7"
            />
          ))}

          {/* 라인 */}
          <path d={d} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />

          {/* 각 valid 점에 hover 가능한 작은 원 + native title */}
          {points.map((p, i) => {
            if (p.score == null) return null;
            const x = xOf(i);
            const y = yOf(Number(p.score));
            const ptColor = p.sentiment === 'POSITIVE' ? '#dc2626'
              : p.sentiment === 'NEGATIVE' ? '#2563eb'
              : '#94a3b8';
            const r = i === n - 1 ? 3 : 1.6;
            return (
              <circle key={i} cx={x} cy={y} r={r} fill={ptColor} stroke="#0f172a" strokeWidth={i === n - 1 ? 1 : 0}>
                <title>
                  {`${p.timestamp ?? ''}\n점수 ${Number(p.score).toFixed(2)} · ${p.sentiment ?? '—'}${p.postCount != null ? ` · 글 ${p.postCount.toLocaleString()}` : ''}`}
                </title>
              </circle>
            );
          })}

          {/* x 라벨 */}
          {xLabels.map(({ i, ts }, idx) => (
            <text key={idx} x={xOf(i)} y={H - 8} fontSize="9" fill="#94a3b8" textAnchor="middle">
              {formatXLabel(ts)}
            </text>
          ))}
        </svg>
      )}

      <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
        ※ 점 위에 마우스 → 정확 시각·점수·sentiment 확인. 배경 밴드 = zone 5단계
        (위에서 극탐욕 → 탐욕 → 중립 → 공포 → 극공포).
      </p>
    </div>
  );
}
