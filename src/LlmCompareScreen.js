import { useState, useMemo } from 'react';
import {
  Bell, Trophy, BarChart3,
  AlertTriangle, X, BookOpen, Info, Activity,
} from 'lucide-react';
import Sidebar from './Sidebar';
import LLM_RULES   from './data/llm_rules.json';
import LLM_RETURNS from './data/llm_strategy_returns.json';
import { computeMetrics, slicePeriod, fmt } from './strategies/metrics';

// llm_rules.json 의 csv_column 과 일치하는 키만 골라 전략 정의 구성.
// 표시 순서: 캡스톤 메인 (개미 디리스킹) → 벤치마크 → LLM 군 (55 universe).
// displayName 으로 universe 노이즈를 제거하고 LLM 이름만 단순 노출.
const STRATEGY_DEFS = [
  { id: 'ant_index_strategy', color: '#4f46e5', emphasis: true,  displayName: '개미지수 디리스킹' },
  { id: 'buy_and_hold',       color: '#64748b', emphasis: false, displayName: 'Buy & Hold (벤치마크)' },
  { id: 'chatgpt_full_55',    color: '#10b981', emphasis: false, displayName: 'ChatGPT' },
  { id: 'claude_compact',     color: '#f59e0b', emphasis: false, displayName: 'Claude' },
  { id: 'gemini',             color: '#0ea5e9', emphasis: false, displayName: 'Gemini' },
]
  // llm_rules.json 에 정의 + csv_column 키가 returns 데이터에도 존재해야 표시
  .map(d => {
    const rule = LLM_RULES[d.id];
    if (!rule) return null;
    const sampleRow = LLM_RETURNS[0] ?? {};
    if (!(rule.csv_column in sampleRow)) return null;
    // displayName 으로 원본 rule.name 을 덮어쓴 사본을 노출.
    return { ...d, rule: { ...rule, name: d.displayName } };
  })
  .filter(Boolean);

const PERIOD_OPTIONS = [
  { id: '3M',  label: '3개월' },
  { id: '6M',  label: '6개월' },
  { id: '1Y',  label: '1년' },
  { id: 'ALL', label: '전체' },
];

const SORT_OPTIONS = [
  { id: 'return', label: '누적수익률 ↓' },
  { id: 'sharpe', label: '샤프 ↓' },
  { id: 'mdd',    label: 'MDD ↑ (덜 잃은 순)' },
  { id: 'win',    label: '승률 ↓' },
];

// =========================================================================
// LlmCompareScreen — LLM 전략 비교 탭 (B-6)
//
// 구성:
//   1) 누적수익률 라인 차트 (인라인 SVG, 전략당 1 라인)
//   2) 기간/정렬 토글
//   3) 메트릭 카드 그리드 (5+개 전략)
//   4) 카드 클릭 → 룰 상세 모달
//   5) data_limits 면책 패널
//
// 데이터: src/data/llm_strategy_returns.json (일별 수익률, 2021-04~2026-05)
//         + src/data/llm_rules.json (룰 description + 출처)
// 백테스트 엔진 없음 — 이미 계산된 일별 수익률에 단순 통계만 적용.
// =========================================================================
export default function LlmCompareScreen({
  currentPage,
  onNavigate,
  unreadCount = 0,
  onToggleNotifications,
}) {
  const [period, setPeriod] = useState('1Y');
  const [sortId, setSortId] = useState('return');
  const [activeDetailId, setActiveDetailId] = useState(null);

  // 기간 슬라이스
  const periodRows = useMemo(() => slicePeriod(LLM_RETURNS, period), [period]);

  // 전략별 메트릭 (기간 적용)
  const strategies = useMemo(() => {
    return STRATEGY_DEFS.map(def => {
      const series = periodRows.map(r => Number(r[def.rule.csv_column] ?? 0));
      const metrics = computeMetrics(series);
      return { ...def, series, metrics };
    });
  }, [periodRows]);

  // 정렬된 카드 순서 (차트 라인 색상은 STRATEGY_DEFS 순 유지)
  const sortedStrategies = useMemo(() => {
    const arr = [...strategies];
    const cmp = {
      return: (a, b) => b.metrics.totalReturn - a.metrics.totalReturn,
      sharpe: (a, b) => b.metrics.sharpe - a.metrics.sharpe,
      mdd:    (a, b) => b.metrics.mdd - a.metrics.mdd,  // mdd는 음수, 큰 게 덜 손해
      win:    (a, b) => b.metrics.winRate - a.metrics.winRate,
    };
    return arr.sort(cmp[sortId] ?? cmp.return);
  }, [strategies, sortId]);

  const dateRange = periodRows.length > 0
    ? `${periodRows[0].date} ~ ${periodRows[periodRows.length - 1].date} (${periodRows.length}거래일)`
    : '';

  const activeStrategy = activeDetailId
    ? STRATEGY_DEFS.find(s => s.id === activeDetailId)
    : null;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />

      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* 상단 헤더 */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <div className="text-lg font-bold text-slate-900">LLM 전략 비교 (백테스트)</div>
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
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 mb-1">LLM 별 투자법 백테스트 비교</h1>
            <p className="text-sm text-slate-500">
              {STRATEGY_DEFS.length}개 전략의 동일 기간·동일 비용 백테스트 결과를 비교합니다.
              <span className="text-slate-400 ml-1">{dateRange && `· ${dateRange}`}</span>
            </p>
          </div>

          {/* 1. 누적수익률 라인 차트 */}
          <section className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
              <h2 className="font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-500" />
                누적 수익률 곡선
              </h2>
              <div className="flex gap-1.5 bg-slate-100 p-0.5 rounded-lg">
                {PERIOD_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setPeriod(opt.id)}
                    className={`px-3 py-1 text-xs rounded-md font-bold transition-all ${
                      period === opt.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <CumulativeChart strategies={strategies} rows={periodRows} />
            {/* 범례 */}
            <div className="flex flex-wrap gap-3 mt-3 text-xs">
              {strategies.map(s => (
                <div key={s.id} className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-0.5 rounded" style={{ background: s.color, height: s.emphasis ? 3 : 2 }} />
                  <span className={`${s.emphasis ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
                    {s.rule.name}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* 2. 메트릭 카드 그리드 */}
          <section>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="font-bold text-slate-900">전략 메트릭</h2>
              <select
                value={sortId}
                onChange={e => setSortId(e.target.value)}
                className="text-xs font-medium border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 hover:bg-slate-50"
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sortedStrategies.map(s => (
                <StrategyCard
                  key={s.id}
                  strategy={s}
                  onClick={() => setActiveDetailId(s.id)}
                />
              ))}
            </div>
          </section>

          {/* 3. 면책 — data_limits */}
          <section className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-amber-900">데이터 한계 (정직 표시)</h3>
                <p className="text-xs text-amber-700 mt-0.5">
                  본 결과는 과거 데이터 기반 시뮬레이션이며 미래 수익을 보장하지 않습니다.
                </p>
              </div>
            </div>
            <ul className="space-y-1.5 text-xs text-amber-800 ml-7">
              {(LLM_RULES.data_limits?.items ?? []).map((item, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-amber-500 flex-shrink-0">·</span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </section>

        </div>
      </main>

      {/* 룰 상세 모달 */}
      {activeStrategy && (
        <RuleModal
          strategy={activeStrategy}
          metrics={strategies.find(s => s.id === activeStrategy.id)?.metrics}
          onClose={() => setActiveDetailId(null)}
        />
      )}
    </div>
  );
}

// ── 누적수익률 라인 차트 (의존성 없는 인라인 SVG) ────────────────────────
function CumulativeChart({ strategies, rows }) {
  const W = 900, H = 320, PAD_L = 56, PAD_R = 16, PAD_T = 12, PAD_B = 32;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  // 전 전략의 cum 시리즈에서 y 범위 산출
  const yMinMax = useMemo(() => {
    let yMin = 0, yMax = 0;
    for (const s of strategies) {
      for (const v of s.metrics.cumulative) {
        if (v < yMin) yMin = v;
        if (v > yMax) yMax = v;
      }
    }
    // 살짝 패딩
    const span = (yMax - yMin) || 1;
    return { yMin: yMin - span * 0.05, yMax: yMax + span * 0.05 };
  }, [strategies]);

  if (rows.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-slate-400">
        해당 기간 데이터가 없습니다.
      </div>
    );
  }

  const n = rows.length;
  const xOf = (i) => PAD_L + (innerW * i) / Math.max(1, n - 1);
  const yOf = (v) => PAD_T + (1 - (v - yMinMax.yMin) / (yMinMax.yMax - yMinMax.yMin)) * innerH;

  // y 눈금 5개
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const v = yMinMax.yMin + ((yMinMax.yMax - yMinMax.yMin) * i) / 4;
    return { v, y: yOf(v) };
  });

  // x 라벨: 5개 정도
  const labelStep = Math.max(1, Math.floor(n / 5));
  const xLabels = rows
    .map((r, i) => ({ i, date: r.date }))
    .filter(({ i }) => i % labelStep === 0)
    .slice(0, 6);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: 320 }}>
        {/* 0 기준선 */}
        {yMinMax.yMin <= 0 && yMinMax.yMax >= 0 && (
          <line
            x1={PAD_L} x2={W - PAD_R}
            y1={yOf(0)} y2={yOf(0)}
            stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3,3"
          />
        )}

        {/* 가로 그리드 + y 라벨 */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={t.y} y2={t.y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={PAD_L - 6} y={t.y} fontSize="11" fill="#64748b" textAnchor="end" dominantBaseline="middle">
              {(t.v * 100).toFixed(1)}%
            </text>
          </g>
        ))}

        {/* 라인 (전략당) — emphasis 우선순위 낮음 먼저 그려서 메인이 위에 보이도록 */}
        {[...strategies].sort((a, b) => Number(a.emphasis) - Number(b.emphasis)).map(s => {
          let d = '';
          s.metrics.cumulative.forEach((v, i) => {
            const cmd = i === 0 ? 'M' : 'L';
            d += `${cmd}${xOf(i).toFixed(2)},${yOf(v).toFixed(2)} `;
          });
          return (
            <path
              key={s.id}
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth={s.emphasis ? 2.5 : 1.4}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={s.emphasis ? 1 : 0.85}
            />
          );
        })}

        {/* x 라벨 */}
        {xLabels.map(({ i, date }, idx) => (
          <text
            key={idx}
            x={xOf(i)}
            y={H - 10}
            fontSize="10"
            fill="#94a3b8"
            textAnchor="middle"
          >
            {date.slice(2)}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── 전략 메트릭 카드 ────────────────────────────────────────────────────
function StrategyCard({ strategy, onClick }) {
  const { rule, color, emphasis, metrics } = strategy;
  return (
    <button
      onClick={onClick}
      className={`text-left bg-white rounded-2xl p-4 border-2 hover:shadow-md transition-all ${
        emphasis ? 'border-indigo-300' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="font-bold text-slate-900 text-sm truncate">{rule.name}</span>
        </div>
        {emphasis && (
          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200 flex-shrink-0">
            캡스톤
          </span>
        )}
      </div>

      <div className="space-y-2">
        <Metric
          label="누적 수익률"
          value={fmt.pct(metrics.totalReturn, 1)}
          color={metrics.totalReturn > 0 ? 'text-red-600' : metrics.totalReturn < 0 ? 'text-blue-600' : 'text-slate-700'}
          big
        />
        <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100">
          <Metric label="샤프" value={fmt.num(metrics.sharpe, 2)} color="text-slate-700" />
          <Metric label="MDD"  value={fmt.pctRaw(metrics.mdd, 1)} color="text-blue-600" />
          <Metric label="승률" value={fmt.pctRaw(metrics.winRate, 0)} color="text-emerald-600" />
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
        <span>{metrics.activeDays}일 활동</span>
        <span className="text-indigo-500 font-bold">자세히 보기 →</span>
      </div>
    </button>
  );
}

function Metric({ label, value, color = 'text-slate-900', big = false }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-slate-500 uppercase">{label}</div>
      <div className={`font-black ${big ? 'text-xl' : 'text-sm'} ${color}`}>{value}</div>
    </div>
  );
}

// ── 룰 상세 모달 ────────────────────────────────────────────────────────
function RuleModal({ strategy, metrics, onClose }) {
  const { rule, color } = strategy;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="min-w-0 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">{rule.name}</h2>
              <p className="text-xs text-slate-500 mt-0.5">출처: {rule.source}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="overflow-y-auto p-6 space-y-5">
          {/* 메트릭 요약 */}
          {metrics && (
            <div className="grid grid-cols-4 gap-2">
              <BigMetric label="누적수익률"
                value={fmt.pct(metrics.totalReturn, 1)}
                color={metrics.totalReturn > 0 ? 'text-red-600' : 'text-blue-600'} />
              <BigMetric label="샤프"   value={fmt.num(metrics.sharpe, 2)} />
              <BigMetric label="MDD"    value={fmt.pctRaw(metrics.mdd, 1)} color="text-blue-600" />
              <BigMetric label="승률"   value={fmt.pctRaw(metrics.winRate, 0)} color="text-emerald-600" />
            </div>
          )}

          {/* 룰 description */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-indigo-500" />
              룰 명세
            </h3>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 leading-relaxed">
              {rule.description}
            </div>
          </section>

          {/* ant_index_strategy 의 weight_by_zone 추가 표시 */}
          {rule.rules?.weight_by_zone && (
            <section>
              <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-indigo-500" />
                Zone → 주식 비중
              </h3>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-5 gap-2 text-center text-xs">
                {Object.entries(rule.rules.weight_by_zone).map(([zone, w]) => (
                  <div key={zone}>
                    <div className="font-bold text-slate-600">{zone}</div>
                    <div className="text-lg font-black text-slate-900 mt-1">{Math.round(w * 100)}%</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 면책 */}
          <section className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800 leading-relaxed">
                본 평가는 캡스톤 백테스트 원본 룰 기준 시뮬레이션 결과입니다.
                실제 LLM 이 추천한 것이 아니라 LLM 답변을 룰화하여 동일 비용·기간으로 백테스트한 결과이며,
                미래 수익을 보장하지 않습니다.
              </p>
            </div>
          </section>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-sm font-bold bg-slate-900 text-white hover:bg-slate-700 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function BigMetric({ label, value, color = 'text-slate-900' }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
      <div className="text-[10px] font-bold text-slate-500 uppercase">{label}</div>
      <div className={`text-base font-black mt-1 ${color}`}>{value}</div>
    </div>
  );
}
