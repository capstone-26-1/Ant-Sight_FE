// 5분봉 배열(DESC) → N분봉 배열(DESC). 5min은 passthrough.
// 버킷 키: KST 분단위 floor(totalMin / interval). 09:00·15:00·15:30 등 자연 경계와 정합.
// OHLCV 규칙: open=구간 첫 캔들, close=마지막, high=max, low=min, volume=합산.
export function aggregateCandles(candlesDesc, intervalMinutes) {
  if (!Array.isArray(candlesDesc) || candlesDesc.length === 0) return [];
  if (intervalMinutes === 5) return candlesDesc;

  const asc = [...candlesDesc].reverse();
  const groups = new Map();
  for (const c of asc) {
    const t  = c.candleTime;
    const date    = t.slice(0, 10);
    const hh      = parseInt(t.slice(11, 13), 10);
    const mm      = parseInt(t.slice(14, 16), 10);
    const bucket  = Math.floor((hh * 60 + mm) / intervalMinutes);
    const key     = `${date}_${bucket}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        ticker:     c.ticker,
        candleTime: c.candleTime,
        openPrice:  c.openPrice,
        highPrice:  c.highPrice,
        lowPrice:   c.lowPrice,
        closePrice: c.closePrice,
        volume:     c.volume,
      });
    } else {
      existing.highPrice = Math.max(existing.highPrice, c.highPrice);
      existing.lowPrice  = Math.min(existing.lowPrice,  c.lowPrice);
      existing.closePrice = c.closePrice;  // ASC 순회라 마지막이 최신
      existing.volume    += c.volume;
    }
  }
  return Array.from(groups.values()).reverse();  // DESC
}

// =========================================================================
// CandleChart - 5분봉 캔들 차트 (의존성 없는 인라인 SVG 구현)
//
// props:
//   candles  - CandleResponse[] (최신순 DESC로 들어옴, 내부에서 ASC로 reverse)
//   width    - SVG 가로 (기본 800, viewBox 기반이라 컨테이너에 맞춰 스케일됨)
//   height   - SVG 세로 (기본 240)
//
// 색상: 한국 컨벤션 — 양봉(상승) 빨강, 음봉(하락) 파랑.
// =========================================================================
export default function CandleChart({ candles = [], width = 800, height = 240 }) {
  if (!candles.length) {
    return (
      <div className="h-48 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">캔들 데이터가 없습니다.</p>
      </div>
    );
  }

  // 최신순 DESC → 시간 ASC 정렬
  const data = [...candles].reverse();

  // 가격 축 범위
  const highs = data.map(c => c.highPrice);
  const lows  = data.map(c => c.lowPrice);
  const maxPrice = Math.max(...highs);
  const minPrice = Math.min(...lows);
  const priceRange = maxPrice - minPrice || 1;

  // 여백 (좌측 가격 축, 하단 시간 축)
  const padLeft   = 56;
  const padRight  = 12;
  const padTop    = 12;
  const padBottom = 28;

  const innerW = width  - padLeft - padRight;
  const innerH = height - padTop  - padBottom;

  const stepX = innerW / data.length;
  const bodyW = Math.max(1, stepX * 0.6);

  const yOf = (price) => padTop + (1 - (price - minPrice) / priceRange) * innerH;

  // 가격 축 눈금 5개
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const p = minPrice + (priceRange * i) / 4;
    return { price: p, y: yOf(p) };
  });

  // 시간 축 라벨 (5개 정도만 표시).
  // 다중일 차트(첫·마지막 캔들 날짜가 다름)면 날짜+시각, 단일일이면 시각만.
  const firstDate = data[0]?.candleTime?.slice(0, 10);
  const lastDate  = data[data.length - 1]?.candleTime?.slice(0, 10);
  const isMultiDay = firstDate && lastDate && firstDate !== lastDate;
  const formatLabel = (t) => {
    if (!t) return '';
    return isMultiDay
      ? `${t.slice(5, 10)} ${t.slice(11, 16)}`  // "MM-DD HH:MM"
      : t.slice(11, 16);                         // "HH:MM"
  };

  const labelCount = Math.min(5, data.length);
  const labelStep  = Math.max(1, Math.floor(data.length / labelCount));
  const xLabels = data
    .map((c, i) => ({ i, c }))
    .filter(({ i }) => i % labelStep === 0)
    .map(({ i, c }) => ({
      x: padLeft + stepX * i + stepX / 2,
      label: formatLabel(c.candleTime),
    }));

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-60"
      >
        {/* 가로 그리드 + 가격 라벨 */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={padLeft} x2={width - padRight}
              y1={t.y} y2={t.y}
              stroke="#e2e8f0" strokeWidth="1"
            />
            <text
              x={padLeft - 6} y={t.y}
              fontSize="10" fill="#94a3b8"
              textAnchor="end" dominantBaseline="middle"
            >
              {Math.round(t.price).toLocaleString()}
            </text>
          </g>
        ))}

        {/* 캔들 */}
        {data.map((c, i) => {
          const isUp = c.closePrice >= c.openPrice;
          const color = isUp ? '#dc2626' : '#2563eb';
          const cx    = padLeft + stepX * i + stepX / 2;
          const yHigh = yOf(c.highPrice);
          const yLow  = yOf(c.lowPrice);
          const yOpen = yOf(c.openPrice);
          const yClose= yOf(c.closePrice);
          const bodyY = Math.min(yOpen, yClose);
          const bodyH = Math.max(1, Math.abs(yClose - yOpen));
          return (
            <g key={i}>
              {/* 심지 */}
              <line x1={cx} x2={cx} y1={yHigh} y2={yLow} stroke={color} strokeWidth="1" />
              {/* 몸통 */}
              <rect
                x={cx - bodyW / 2}
                y={bodyY}
                width={bodyW}
                height={bodyH}
                fill={color}
              />
            </g>
          );
        })}

        {/* 시간 라벨 */}
        {xLabels.map((l, i) => (
          <text
            key={i}
            x={l.x} y={height - 8}
            fontSize="10" fill="#94a3b8"
            textAnchor="middle"
          >
            {l.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
