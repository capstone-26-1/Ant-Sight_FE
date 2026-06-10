import { useState } from 'react';
import {
  TrendingUp, TrendingDown, Minus, BrainCircuit, Maximize2, X,
  CheckCircle2, AlertTriangle, BookOpen, ChevronRight,
} from 'lucide-react';
import { generateModelPredictions, generateModelDetails } from './aiModelDummy';

// =========================================================================
// AiModelComparison
//   탐색 탭의 AI 개미 지수 리포트에서 진입하는 모델 비교 섹션.
//   현재는 더미 데이터 (aiModelDummy.js) 기반.
//   실제 API가 붙을 경우 generateModelPredictions만 교체하면 됨.
//
//   상태:
//     - activeModelId 가 null이면 카드 그리드 뷰
//     - activeModelId 가 모델 id면 "자세히 보기" 큰 탭형 분석 뷰
//
//   props:
//     ticker   - 종목 ticker (시드용)
//     antIndex - 합성/실제 antIndex (0~100, 50=중립). null이면 데이터 없음 메시지.
//     quote    - QuoteResponse 또는 null
// =========================================================================
export default function AiModelComparison({ ticker, antIndex, quote }) {
  const [activeModelId, setActiveModelId] = useState(null);

  if (antIndex == null && !quote) {
    return (
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
        <div className="text-sm text-slate-400 text-center py-4">
          시세 데이터 로딩 후 모델 비교가 표시됩니다.
        </div>
      </div>
    );
  }

  const predictions = generateModelPredictions({ ticker, antIndex, quote });

  // 자세히 보기 모드 — 탭 전환형 큰 뷰
  if (activeModelId) {
    return (
      <ModelDetailView
        predictions={predictions}
        activeModelId={activeModelId}
        onSwitchTab={setActiveModelId}
        onClose={() => setActiveModelId(null)}
        antIndex={antIndex}
        quote={quote}
      />
    );
  }

  // 기본 그리드 뷰
  const antPred = predictions.find(p => p.model.id === 'ant')?.prediction;
  const commercial = predictions.filter(p => p.model.id !== 'ant');

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <BrainCircuit className="w-5 h-5 text-indigo-500" />
        <h2 className="font-bold">AI 모델 예측 비교</h2>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        AntModel vs 상용 LLM/시계열 모델 — 같은 종목 상태를 어떻게 해석하는지 비교합니다.
        <span className="ml-1 text-amber-600 font-medium">(API 연동 전 데모 더미)</span>
      </p>

      {/* 개미모델 강조 카드 */}
      {antPred && (
        <div className="mb-4">
          <ModelCard
            model={predictions[0].model}
            prediction={antPred}
            emphasized
            onOpenDetail={() => setActiveModelId('ant')}
          />
        </div>
      )}

      {/* vs 구분선 */}
      <div className="flex items-center gap-3 my-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs font-bold text-slate-400">VS 상용 모델</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* 상용 모델 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {commercial.map(({ model, prediction }) => (
          <ModelCard
            key={model.id}
            model={model}
            prediction={prediction}
            onOpenDetail={() => setActiveModelId(model.id)}
          />
        ))}
      </div>

      <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
        * 각 모델 API는 추후 연동 예정. 현재 표시는 종목 상태와 개미지수를 기반으로 한 보수적 시뮬레이션입니다.
        실제 투자 판단에는 사용하지 마세요.
      </p>
    </div>
  );
}

// =========================================================================
// ModelDetailView — "자세히 보기" 탭 전환형 큰 분석 뷰
//   상단에 5개 모델 탭 → 클릭으로 즉시 전환
//   본문: 모델별 큰 메트릭 + 분석 이유(summary/signals/risks/methodology)
// =========================================================================
function ModelDetailView({ predictions, activeModelId, onSwitchTab, onClose, antIndex, quote }) {
  const active = predictions.find(p => p.model.id === activeModelId);
  if (!active) return null;
  const { model, prediction } = active;
  const details = generateModelDetails({ modelId: model.id, prediction, antIndex, quote });

  const dirCfg = prediction ? DIR_CFG[prediction.direction] : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* ── 헤더 ─────────────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <BrainCircuit className="w-5 h-5 text-indigo-500 flex-shrink-0" />
          <h2 className="font-bold text-slate-900 truncate">AI 모델 상세 분석</h2>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
          닫기
        </button>
      </div>

      {/* ── 탭 바 ────────────────────────────────────────────────────── */}
      <div className="px-2 pt-2 bg-slate-50 border-b border-slate-200 flex gap-1 overflow-x-auto">
        {predictions.map(({ model: m, prediction: p }) => {
          const isActive = m.id === activeModelId;
          const dir = p?.direction ?? 'HOLD';
          return (
            <button
              key={m.id}
              onClick={() => onSwitchTab(m.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-bold whitespace-nowrap transition-all border-b-2 ${
                isActive
                  ? 'bg-white text-slate-900 border-indigo-500 shadow-sm'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              <span>{m.name}</span>
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                dir === 'BUY' ? 'bg-red-100 text-red-700' :
                dir === 'SELL' ? 'bg-blue-100 text-blue-700' :
                'bg-slate-200 text-slate-600'
              }`}>
                {dir === 'BUY' ? '매수' : dir === 'SELL' ? '매도' : '관망'}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── 본문 ─────────────────────────────────────────────────────── */}
      <div className="p-6 space-y-5">
        {/* 모델 헤더: 이름·태그·방향 큰 표시 */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-2xl font-extrabold text-slate-900">{model.name}</h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {model.vendor}
              </span>
            </div>
            <p className="text-xs text-slate-500">{model.tag}</p>
          </div>
          {prediction && dirCfg && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 ${dirCfg.bg}`}>
              <dirCfg.Icon className={`w-5 h-5 ${dirCfg.color}`} />
              <span className={`text-lg font-black ${dirCfg.color}`}>{dirCfg.label}</span>
              <span className="text-xs text-slate-500 ml-1">확신도 {CONVICTION_KOR[prediction.conviction] ?? '-'}</span>
            </div>
          )}
        </div>

        {/* 주요 메트릭 카드 (큰 사이즈) */}
        {prediction && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <BigMetric label="예측 승률" value={`${prediction.winRate}%`} color="text-emerald-600" />
            <BigMetric
              label="예측 수익률"
              value={`${prediction.expectedReturn > 0 ? '+' : ''}${prediction.expectedReturn}%`}
              color={prediction.expectedReturn > 0 ? 'text-red-600' : prediction.expectedReturn < 0 ? 'text-blue-600' : 'text-slate-700'}
            />
            <BigMetric label="홀딩 기간" value={prediction.holdingDays > 0 ? `${prediction.holdingDays}일` : '-'} color="text-violet-600" />
          </div>
        )}

        {/* 분석 요약 */}
        {details && (
          <section className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <h4 className="font-bold text-indigo-900 text-sm">분석 요약</h4>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{details.summary}</p>
          </section>
        )}

        {/* 모델 방법론 */}
        {details && (
          <section>
            <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-slate-700" />
              모델 방법론
            </h4>
            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-4">
              {details.methodology}
            </p>
          </section>
        )}

        {/* 긍정 시그널 */}
        {details && details.signals.length > 0 && (
          <section>
            <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              이 모델이 본 근거
            </h4>
            <ul className="space-y-2">
              {details.signals.map((s, i) => (
                <li key={i} className="flex items-start gap-3 p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg">
                  <ChevronRight className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 text-sm">{s.label}</div>
                    <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">{s.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 리스크 */}
        {details && details.risks.length > 0 && (
          <section>
            <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              주의할 리스크
            </h4>
            <ul className="space-y-2">
              {details.risks.map((r, i) => (
                <li key={i} className="flex items-start gap-3 p-3 bg-amber-50/50 border border-amber-100 rounded-lg">
                  <ChevronRight className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 text-sm">{r.label}</div>
                    <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">{r.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-slate-100">
          * 실제 모델 API 연동 전 데모용 시뮬레이션입니다. 표시 수치 및 근거는 종목 상태/개미지수를 기반으로 한 결정론적 더미 값으로,
          실제 투자 판단에 사용하지 마세요.
        </p>
      </div>
    </div>
  );
}

// ── 방향/확신도 매핑 (공통) ──────────────────────────────────────────────
const DIR_CFG = {
  BUY:  { label: '매수',   color: 'text-red-600',  bg: 'bg-red-50  border-red-200',  Icon: TrendingUp   },
  SELL: { label: '매도',   color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', Icon: TrendingDown },
  HOLD: { label: '관망',   color: 'text-slate-600',bg: 'bg-slate-50 border-slate-200',Icon: Minus       },
};
const CONVICTION_KOR = { high: '강함', medium: '보통', low: '약함' };

// ── 단일 모델 카드 ───────────────────────────────────────────────────────
function ModelCard({ model, prediction, emphasized = false, onOpenDetail }) {
  if (!prediction) {
    return (
      <div className={`p-3 rounded-xl border ${model.accentClass}`}>
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-sm text-slate-800">{model.name}</span>
          <span className="text-[10px] text-slate-400">{model.vendor}</span>
        </div>
        <p className="text-xs text-slate-400">데이터 부족 — 예측 불가</p>
      </div>
    );
  }

  const { direction, winRate, expectedReturn, holdingDays, rationale, conviction } = prediction;
  const dirCfg = DIR_CFG[direction];

  return (
    <div className={`p-3 rounded-xl border ${emphasized ? 'border-indigo-400 bg-indigo-50 shadow-sm' : model.accentClass}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-sm text-slate-900 truncate">{model.name}</span>
          {emphasized && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-600 text-white flex-shrink-0">
              {model.tag}
            </span>
          )}
        </div>
        <span className="text-[10px] text-slate-500 flex-shrink-0 ml-2">{model.vendor}</span>
      </div>

      {/* 방향 + 확신도 */}
      <div className={`flex items-center gap-2 px-2 py-1 rounded-md border ${dirCfg.bg} mb-2 w-fit`}>
        <dirCfg.Icon className={`w-3.5 h-3.5 ${dirCfg.color}`} />
        <span className={`text-xs font-bold ${dirCfg.color}`}>{dirCfg.label}</span>
        <span className="text-[10px] text-slate-500 ml-1">확신도 {CONVICTION_KOR[conviction] ?? '-'}</span>
      </div>

      {/* 메트릭 */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <Metric label="예측승률"   value={`${winRate}%`} />
        <Metric label="예측수익률" value={`${expectedReturn > 0 ? '+' : ''}${expectedReturn}%`}
                color={expectedReturn > 0 ? 'text-red-600' : expectedReturn < 0 ? 'text-blue-600' : 'text-slate-700'} />
        <Metric label="홀딩기간"   value={holdingDays > 0 ? `${holdingDays}일` : '-'} />
      </div>

      <p className="text-[11px] text-slate-600 leading-snug mb-2">{rationale}</p>

      {/* 자세히 보기 버튼 */}
      {onOpenDetail && (
        <button
          onClick={onOpenDetail}
          className={`w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-bold transition-colors ${
            emphasized
              ? 'bg-indigo-600 text-white hover:bg-indigo-500'
              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Maximize2 className="w-3 h-3" />
          자세히 보기
        </button>
      )}
    </div>
  );
}

function Metric({ label, value, color = 'text-slate-900' }) {
  return (
    <div className="bg-white/60 rounded p-1.5 border border-white/80">
      <div className="text-[9px] font-bold text-slate-500 uppercase">{label}</div>
      <div className={`text-xs font-bold ${color}`}>{value}</div>
    </div>
  );
}

function BigMetric({ label, value, color = 'text-slate-900' }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <div className="text-xs font-bold text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-black ${color}`}>{value}</div>
    </div>
  );
}
