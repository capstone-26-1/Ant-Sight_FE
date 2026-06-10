// =========================================================================
// aiModelDummy.js
// 상용 AI 모델 API가 아직 없어 임시 더미를 만들어주는 모듈.
// 실제 API가 붙기 전까지의 데모용으로만 사용.
//
// 설계 원칙:
//   1) 보수적 — 승률·수익률을 과장하지 않음 (요구사항 #7)
//   2) 주식 현황 기반 — quote(현재가/등락) 데이터로 antIndex를 합성 (#7)
//   3) 개미모델 더미는 antIndex와 직접 연동 (#8)
//   4) 상용 모델은 개미모델과 의도적으로 다른 시각을 보이도록 차별화 (#5)
// =========================================================================

// ── antIndex 합성 ────────────────────────────────────────────────────────
// /quote의 changeRate 흐름을 기반으로 0~100 범위로 산출 (BE 컨벤션 일치).
// 실제 antIndex가 들어오면 그 값을 우선 사용 (요구사항 #2).
//
// 직관: 중립 50을 기준으로 등락률 1% 당 약 7.5포인트.
//   changeRate -5% → 12.5  (극심한 공포)
//   changeRate -2% → 35    (공포)
//   changeRate  0% → 50    (중립)
//   changeRate +3% → 72.5  (탐욕)
//   changeRate +6% → 95    (광기)
export function deriveAntIndex(realAntIndex, quote) {
  if (realAntIndex != null) return realAntIndex;
  if (!quote || quote.changeRate == null) return null;
  const raw = quote.changeRate * 7.5 + 50;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

// ── 모델 정의 ────────────────────────────────────────────────────────────
// 이 정의에 카드만 추가하면 #4 상용모델 탭 확장이 자동으로 반영됨.
export const MODEL_DEFS = [
  { id: 'ant',     name: 'AntModel',       vendor: 'AntSight', tag: '개미지수 기반', accentClass: 'border-indigo-300 bg-indigo-50' },
  { id: 'chatgpt', name: 'ChatGPT',        vendor: 'OpenAI',   tag: '범용 LLM',      accentClass: 'border-emerald-200 bg-emerald-50' },
  { id: 'claude',  name: 'Claude',         vendor: 'Anthropic',tag: '범용 LLM',      accentClass: 'border-amber-200 bg-amber-50' },
  { id: 'gemini',  name: 'Gemini',         vendor: 'Google',   tag: '범용 LLM',      accentClass: 'border-sky-200 bg-sky-50' },
  { id: 'kronos',  name: 'Kronos',         vendor: 'Quant',    tag: '시계열 전용',   accentClass: 'border-rose-200 bg-rose-50' },
];

// ── 헬퍼 ─────────────────────────────────────────────────────────────────
const round1 = (n) => Math.round(n * 10) / 10;
const clamp  = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// 시드 기반 결정론적 의사난수 — 같은 종목/모델은 항상 같은 결과 (데모 안정성).
function seededRand(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // [0,1)
  return ((h >>> 0) % 100000) / 100000;
}

// ── 개미모델: antIndex 역방향 (역배포) 시각 ──────────────────────────────
// 0~100 스케일 (50 = 중립).
//   극단적 공포(antIndex ≤ 15) → 반등 BUY 시그널
//   극단적 탐욕(antIndex ≥ 85) → 차익실현 SELL 시그널
function antModelPrediction(antIndex) {
  if (antIndex == null) return null;
  // 방향: antIndex 극단치와 반대
  let direction, conviction;
  if (antIndex <= 15)      { direction = 'BUY';  conviction = 'high';   }
  else if (antIndex <= 35) { direction = 'BUY';  conviction = 'medium'; }
  else if (antIndex <  65) { direction = 'HOLD'; conviction = 'low';    }
  else if (antIndex <  85) { direction = 'SELL'; conviction = 'medium'; }
  else                     { direction = 'SELL'; conviction = 'high';   }

  // 중립(50)으로부터의 거리 = 강도 (0..1)
  const magnitude = Math.abs(antIndex - 50) / 50;
  // 보수적 한도 — 승률 70% 이상 금지, 수익률은 ±5% 이내.
  const winRate   = round1(50 + magnitude * 18);       // 50~68
  const expReturn = direction === 'HOLD'
    ? 0
    : round1((direction === 'BUY' ? 1 : -1) * (1.2 + magnitude * 3.5)); // ±1.2~±4.7%

  return {
    direction,
    conviction,
    winRate,             // %
    expectedReturn: expReturn, // %
    holdingDays: direction === 'HOLD' ? 0 : Math.round(3 + magnitude * 7), // 3~10일
    rationale: direction === 'BUY'
      ? '커뮤니티 공포 심리가 극단치에 근접 — 통계적으로 단기 반등 구간.'
      : direction === 'SELL'
      ? '과열 신호 감지 — 단기 차익실현 권장 구간.'
      : '뚜렷한 비대칭 신호 없음 — 관망 권장.',
  };
}

// ── 상용 모델: 종목 상태(quote) 기반, 모델별 성향 차등 ──────────────────
function commercialModelPrediction(modelId, quote, antIndex, ticker) {
  if (!quote) return null;
  const seed = seededRand(`${ticker}_${modelId}`);
  const changeRate = quote.changeRate ?? 0;

  // 모델별 성향:
  //   chatgpt: 보수적 컨센서스 (HOLD 비중 큼)
  //   claude:  분석적, antIndex를 일부 참고
  //   gemini:  모멘텀 추종 (changeRate 방향과 같이 감)
  //   kronos:  시계열 전용 — 짧은 홀딩, 단기 평균회귀
  let direction, winRate, expReturn, holdingDays, rationale;

  switch (modelId) {
    case 'chatgpt':
      // 큰 변동 때만 의견 표시, 평상시 HOLD
      direction = Math.abs(changeRate) < 1.5 ? 'HOLD'
        : changeRate > 0 ? 'BUY' : 'SELL';
      winRate    = round1(52 + seed * 8);    // 52~60
      expReturn  = round1((direction === 'HOLD' ? 0 : (direction === 'BUY' ? 1 : -1)) * (0.8 + seed * 1.5));
      holdingDays = direction === 'HOLD' ? 0 : Math.round(5 + seed * 5);
      rationale   = '과거 패턴 컨센서스 기반 — 추세 확실성 부족 시 관망 권장.';
      break;
    case 'claude':
      // antIndex(0~100, 50=중립)를 -100~+100 척도로 환산 후 30% 가중 + changeRate 역방향 가중
      const score = ((antIndex ?? 50) - 50) * 0.6 - changeRate * 7;
      direction = score > 15 ? 'BUY' : score < -15 ? 'SELL' : 'HOLD';
      winRate    = round1(54 + seed * 10);   // 54~64
      expReturn  = round1((direction === 'HOLD' ? 0 : (direction === 'BUY' ? 1 : -1)) * (1.0 + seed * 2.0));
      holdingDays = direction === 'HOLD' ? 0 : Math.round(4 + seed * 6);
      rationale   = '심리 지표와 가격 동조성 분석 — 비대칭 시 진입.';
      break;
    case 'gemini':
      // 모멘텀 — 등락률 방향 추종
      direction = Math.abs(changeRate) < 0.5 ? 'HOLD'
        : changeRate > 0 ? 'BUY' : 'SELL';
      winRate    = round1(50 + seed * 12);   // 50~62
      expReturn  = round1((direction === 'HOLD' ? 0 : (direction === 'BUY' ? 1 : -1)) * (1.4 + seed * 2.5));
      holdingDays = direction === 'HOLD' ? 0 : Math.round(2 + seed * 4);
      rationale   = '단기 모멘텀 추종 — 추세 지속 가정.';
      break;
    case 'kronos':
      // 시계열 전용 — 짧은 홀딩, 평균회귀
      direction = Math.abs(changeRate) < 1.0 ? 'HOLD'
        : changeRate > 0 ? 'SELL' : 'BUY';     // 평균회귀
      winRate    = round1(55 + seed * 14);   // 55~69
      expReturn  = round1((direction === 'HOLD' ? 0 : (direction === 'BUY' ? 1 : -1)) * (0.9 + seed * 1.6));
      holdingDays = direction === 'HOLD' ? 0 : Math.round(1 + seed * 3);
      rationale   = '단기 평균회귀 시계열 모델 — 과도한 변동 후 되돌림 진입.';
      break;
    default:
      return null;
  }

  return {
    direction,
    conviction: winRate >= 60 ? 'medium' : 'low',
    winRate: clamp(winRate, 50, 70),
    expectedReturn: expReturn,
    holdingDays,
    rationale,
  };
}

// ── 외부 진입점 ──────────────────────────────────────────────────────────
// 반환: [{ model: MODEL_DEFS[i], prediction: {...} | null }, ...]
export function generateModelPredictions({ ticker, antIndex, quote }) {
  return MODEL_DEFS.map(model => ({
    model,
    prediction: model.id === 'ant'
      ? antModelPrediction(antIndex)
      : commercialModelPrediction(model.id, quote, antIndex, ticker),
  }));
}

// ── 진입 가능 구간 계산 (요구사항 #6) ────────────────────────────────────
// 개미모델 예측 결과 + 현재가 → 진입가/손절가/목표가 산출.
// 보수적: 손절은 기대수익의 절반, 진입가 밴드는 ±0.3%.
export function calculateEntryZone(antIndex, currentPrice) {
  const antPred = antModelPrediction(antIndex);
  if (!antPred || currentPrice == null || currentPrice <= 0) return null;
  if (antPred.direction === 'HOLD') {
    return { type: 'HOLD', conviction: antPred.conviction, winRate: antPred.winRate };
  }

  const expPct = Math.abs(antPred.expectedReturn); // 1.2 ~ 4.7
  const stopPct = round1(expPct * 0.5);             // 보수적 손절선
  const entryLow  = Math.round(currentPrice * 0.997);
  const entryHigh = Math.round(currentPrice * 1.003);

  if (antPred.direction === 'BUY') {
    return {
      type: 'BUY',
      entryLow,
      entryHigh,
      stopLoss: Math.round(currentPrice * (1 - stopPct / 100)),
      target:   Math.round(currentPrice * (1 + expPct  / 100)),
      stopPct,
      targetPct: round1(expPct),
      winRate: antPred.winRate,
      holdingDays: antPred.holdingDays,
      conviction: antPred.conviction,
    };
  }
  // SELL — 차익실현 / 단기 매도 구간
  return {
    type: 'SELL',
    entryLow,
    entryHigh,
    stopLoss: Math.round(currentPrice * (1 + stopPct / 100)),
    target:   Math.round(currentPrice * (1 - expPct  / 100)),
    stopPct,
    targetPct: round1(expPct),
    winRate: antPred.winRate,
    holdingDays: antPred.holdingDays,
    conviction: antPred.conviction,
  };
}

// ── 모델별 상세 분석 ─────────────────────────────────────────────────────
// "자세히 보기" 모달/탭에서 보여줄 확장된 분석 텍스트.
// 각 모델은 자기만의 methodology를 가지며, direction × model 조합에 따라
// summary / signals(긍정 근거) / risks(부정 근거)가 달라진다.

const METHODOLOGY = {
  ant:
    '커뮤니티 게시물 감성 분석과 거래량 패턴을 결합해 개미지수(0~100, 50=중립)를 산출하고, ' +
    '극단치에서 역방향 시그널을 추출합니다. 공포 절정(0 근방) → 단기 반등, 탐욕 절정(100 근방) → 단기 조정이라는 ' +
    '심리적 비대칭에 기반한 모델입니다.',
  chatgpt:
    '다양한 시장 자료와 과거 패턴을 종합한 컨센서스 기반 추론. ' +
    '명확한 추세 신호가 없을 때는 의도적으로 HOLD를 유지하여 false-positive를 줄입니다.',
  claude:
    '가격 동조성과 심리 지표의 비대칭성을 함께 분석. ' +
    '커뮤니티 심리(antIndex)에 일정 가중을 두어 가격이 심리와 어긋날 때 진입 시그널을 발생시킵니다.',
  gemini:
    '단기 모멘텀 추종 — 직전 등락률 방향과 거래량 흐름을 추세 지속 신호로 해석합니다. ' +
    '추세가 살아 있는 동안 따라가는 트렌드-팔로잉 모델입니다.',
  kronos:
    '시계열 평균회귀 모델 — 단기 과변동(과매수/과매도) 후 평균선으로 되돌아가는 통계 성질을 활용합니다. ' +
    '짧은 홀딩 기간이 특징입니다.',
};

// 방향별 시그널/리스크 템플릿 — 모델 색채를 가미하기 위해 직접 합성
function buildSignals(modelId, direction, antIndex, quote) {
  const changeRate = quote?.changeRate ?? 0;
  const volume = quote?.accVolume ?? null;
  // 중립(50)으로부터의 거리 → 0~100 강도
  const extremity = antIndex == null ? 0 : Math.round(Math.abs(antIndex - 50) * 2);

  const fmtIdx = antIndex != null ? Math.round(antIndex) : '-';
  const fmtChg = changeRate.toFixed(2);

  if (direction === 'HOLD') {
    return [
      { label: '추세 불명확', detail: `등락률 ±${Math.abs(changeRate).toFixed(2)}% — 방향성 부족.` },
      { label: '심리 중립', detail: `개미지수 ${fmtIdx} — 50 근방으로 비대칭 거래 기회 부족.` },
      { label: '관망 권장', detail: '시그널 강도 약 — 추세 형성 후 재평가.' },
    ];
  }

  // 공통 베이스
  const base = [];
  if (direction === 'BUY') {
    base.push({ label: '심리 과매도', detail: `개미지수 ${fmtIdx}/100 (강도 ${extremity}/100) — 공포 구간 진입.` });
    base.push({ label: '가격 하락 이력', detail: `금일 등락률 ${fmtChg}% — 단기 낙폭 누적.` });
  } else {
    base.push({ label: '심리 과매수', detail: `개미지수 ${fmtIdx}/100 (강도 ${extremity}/100) — 탐욕 구간 도달.` });
    base.push({ label: '가격 상승 이력', detail: `금일 등락률 +${fmtChg}% — 단기 급등 누적.` });
  }
  if (volume != null) {
    base.push({ label: '거래량 동반', detail: `누적거래량 ${volume.toLocaleString()}주 — 추세 신호의 신뢰도 보강.` });
  }

  // 모델별 추가 신호
  const modelExtras = {
    ant:
      direction === 'BUY'
        ? [{ label: '커뮤니티 손절 언급 급증', detail: '직전 24시간 손절 키워드 빈도 평균 대비 2~3배 — 투매 패턴.' }]
        : [{ label: '커뮤니티 가즈아 폭증',     detail: '직전 24시간 매수 기대 키워드 빈도 평균 대비 2~3배 — 과열.' }],
    chatgpt: [{ label: '과거 패턴 컨센서스', detail: '유사 상황의 과거 사례 다수가 동일 방향으로 수렴 — 의견 일치 신호.' }],
    claude:  [{ label: '심리·가격 동조성 분석', detail: '심리 지표와 가격 변동의 불일치 정도가 임계치 초과.' }],
    gemini:  [{ label: '모멘텀 지속 신호', detail: '직전 봉의 양봉/음봉 연속성 — 추세 가속.' }],
    kronos:  [{ label: '평균회귀 임계 도달', detail: '단기 평균(MA20) 대비 표준편차 1.5σ 이탈 — 회귀 압력.' }],
  };

  return [...base, ...(modelExtras[modelId] ?? [])];
}

function buildRisks(modelId, direction, antIndex) {
  const common = [
    { label: '시그널 오작동 가능', detail: '단일 모델 신호로 과도한 비중 베팅 금지. 분할 진입 권장.' },
    { label: '매크로 변수', detail: '금리·환율·지정학 등 외부 충격 시 모델 가정 무력화 가능.' },
  ];
  const modelRisks = {
    ant: [{ label: '심리 추가 악화', detail: '공포 → 더 깊은 공포로 확장될 경우 반등 전 손절 트리거 가능.' }],
    chatgpt: [{ label: '컨센서스 편향', detail: '시장 다수 의견이 같은 방향이라 콘트라리언 기회 놓칠 수 있음.' }],
    claude: [{ label: '비대칭 신호 노이즈', detail: '심리-가격 비대칭이 일시적 노이즈일 가능성 (false signal).' }],
    gemini: [{ label: '추세 반전 리스크', detail: '모멘텀 모델은 천정/바닥 부근 진입 시 손절 폭이 커질 수 있음.' }],
    kronos: [{ label: '추세 지속', detail: '평균회귀 가정이 깨지는 추세장(breakout)에서는 손실 가능.' }],
  };
  // direction-specific extra risk
  if (direction === 'BUY') {
    common.push({ label: '바닥 미확인', detail: '추가 하락 후 반등 시나리오 대비 손절선 사전 설정 권장.' });
  } else if (direction === 'SELL') {
    common.push({ label: '추가 상승 가능', detail: '강세장에서는 차익실현 후 추가 랠리에서 기회 비용 발생.' });
  }
  return [...common, ...(modelRisks[modelId] ?? [])];
}

function buildSummary(modelId, direction, antIndex, quote) {
  const idxStr = antIndex != null ? `${Math.round(antIndex)}/100` : '-';
  const chgStr = quote?.changeRate != null ? `${quote.changeRate >= 0 ? '+' : ''}${quote.changeRate.toFixed(2)}%` : '-';
  const dirKor = direction === 'BUY' ? '매수' : direction === 'SELL' ? '매도(차익실현)' : '관망';

  const modelTone = {
    ant:     '커뮤니티 심리의 극단치 시점에 역방향 진입을 노립니다',
    chatgpt: '여러 자료의 컨센서스를 종합한 결과',
    claude:  '가격과 심리의 비대칭을 정밀 분석한 결과',
    gemini:  '단기 모멘텀의 방향을 따라가는 관점',
    kronos:  '단기 변동성의 평균회귀 압력을 측정한 결과',
  }[modelId] ?? '';

  if (direction === 'HOLD') {
    return `현재 개미지수 ${idxStr}, 금일 등락률 ${chgStr} — ${modelTone}, 뚜렷한 비대칭 신호가 부족하여 관망을 권장합니다.`;
  }
  return `현재 개미지수 ${idxStr}, 금일 등락률 ${chgStr} — ${modelTone}, 단기 ${dirKor} 시그널이 관측되었습니다.`;
}

// 외부 진입점 — UI에서 활성 모델 카드 펼침 시 호출
export function generateModelDetails({ modelId, prediction, antIndex, quote }) {
  if (!prediction) return null;
  return {
    methodology: METHODOLOGY[modelId] ?? '모델 정보 없음.',
    summary: buildSummary(modelId, prediction.direction, antIndex, quote),
    signals: buildSignals(modelId, prediction.direction, antIndex, quote),
    risks:   buildRisks(modelId, prediction.direction, antIndex),
  };
}

// ── 시장 랭킹 생성 (시장 분석 탭용) ───────────────────────────────────────
// 실제 시세 API가 없으므로 ticker 기반 시드로 결정론적 더미 (antIndex, changeRate)
// 를 생성한다. 그 위에 antModelPrediction을 적용해 각 종목의 win rate /
// expected return / direction 을 산출한다.
//
// 입력: [{ ticker, name, marketCapRank }, ...]  (top100Stocks.json 형식)
// 출력: [{ ticker, name, marketCapRank, antIndex, changeRate,
//          direction, winRate, expectedReturn, holdingDays, conviction }, ...]
export function generateMarketRankings(stocks) {
  if (!Array.isArray(stocks)) return [];
  return stocks
    .map(s => {
      // ticker 시드 → [0,1) 두 개 — antIndex / changeRate에 각각 사용
      const r1 = seededRand(`${s.ticker}_idx`);
      const r2 = seededRand(`${s.ticker}_chg`);

      // antIndex: 0 ~ 100 (BE 컨벤션 일치)
      const antIndex = Math.round(r1 * 100);
      // changeRate: -6% ~ +6%
      const changeRate = round1((r2 - 0.5) * 12);

      const pred = antModelPrediction(antIndex);
      return {
        ticker: s.ticker,
        name: s.name,
        marketCapRank: s.marketCapRank,
        antIndex,
        changeRate,
        direction: pred?.direction ?? 'HOLD',
        winRate: pred?.winRate ?? 50,
        expectedReturn: pred?.expectedReturn ?? 0,
        holdingDays: pred?.holdingDays ?? 0,
        conviction: pred?.conviction ?? 'low',
      };
    });
}
