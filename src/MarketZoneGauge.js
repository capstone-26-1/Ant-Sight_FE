import { useState, useEffect } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import { antIndexApi, ANT_INDEX_ZONES, getAntIndexZone } from './api/antIndex';

// =========================================================================
// MarketZoneGauge — 시장 단위 zone 게이지 (캡스톤 §5 운영 시스템 동일)
//
//   - score 산출: getAntIndexRanking({ window: '24h', positive, limit }) 의
//     avg_score 평균. ranking API 의 positive 50 ∪ negative 50 합집합도 가능.
//   - 5단계 매핑 + 권장 주식 비중:
//       <25  극공포  100%   #1976D2
//       25–45 공포   100%   #4FC3F7
//       45–55 중립   100%   #FFB300
//       55–75 탐욕    60%   #F57C00
//       ≥75  극탐욕   30%   #C62828
//
// props:
//   compact (boolean) — true면 작은 카드형, false면 풀폭(기본)
//   className          — 추가 wrapper 클래스
// =========================================================================
const POLL_MS = 120 * 1000;  // 2분. 15분 cron이라 더 짧게 의미 X.

export default function MarketZoneGauge({ compact = false, className = '' }) {
  const [score, setScore]     = useState(null);
  const [sampleN, setSampleN] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchMarketScore = () => {
      // positive 50 + negative 50 모두 받아 합집합으로 시장 평균 추정.
      // 한쪽만 받으면 편향이 생김.
      Promise.all([
        antIndexApi.getRanking({ window: '24h', direction: 'positive', limit: 50 }),
        antIndexApi.getRanking({ window: '24h', direction: 'negative', limit: 50 }),
      ])
        .then(([pos, neg]) => {
          if (cancelled) return;
          const map = new Map();
          for (const it of pos?.items ?? []) map.set(it.ticker, Number(it.avgScore));
          for (const it of neg?.items ?? []) map.set(it.ticker, Number(it.avgScore));
          const values = [...map.values()].filter(v => Number.isFinite(v));
          if (values.length === 0) {
            setScore(null);
            setSampleN(0);
            setError('수집된 개미지수 데이터가 없습니다.');
          } else {
            const avg = values.reduce((s, v) => s + v, 0) / values.length;
            setScore(avg);
            setSampleN(values.length);
            setError(null);
            setUpdatedAt(new Date());
          }
        })
        .catch(err => {
          if (cancelled || err.status === 401) return;
          setError(err.message || '시장 지수를 불러오지 못했습니다.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    fetchMarketScore();
    const id = setInterval(fetchMarketScore, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const zone = getAntIndexZone(score);

  if (compact) {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${zone.bg} ${zone.border} ${className}`}>
        <div
          className="w-2.5 h-10 rounded-full flex-shrink-0"
          style={{ background: zone.color }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase text-slate-500">시장 zone</div>
          <div className="flex items-baseline gap-2">
            <span className={`text-lg font-black ${zone.text}`}>{zone.label}</span>
            <span className="text-xs text-slate-500">
              {score != null ? score.toFixed(1) : '—'}
            </span>
          </div>
        </div>
        {zone.weight != null && (
          <div className="text-right flex-shrink-0">
            <div className="text-[10px] font-bold text-slate-400 uppercase">주식 비중</div>
            <div className={`text-base font-black ${zone.text}`}>{zone.weight}%</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl p-5 border ${zone.border} shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-slate-700" />
          <h2 className="text-lg font-bold text-slate-900">시장 zone (디리스킹 게이지)</h2>
        </div>
        <span className="text-[11px] text-slate-400">
          {loading && score == null
            ? '집계 중...'
            : sampleN > 0
              ? `${sampleN}개 종목 24h 평균`
              : '데이터 부족'}
        </span>
      </div>

      {error && score == null ? (
        <div className="py-6 text-center text-slate-400 text-sm">{error}</div>
      ) : (
        <>
          {/* 5단계 그라데이션 막대 + 현재 위치 표시 */}
          <ZoneBar score={score} />

          {/* 현재 zone 카드 */}
          <div className={`mt-4 rounded-xl p-4 border ${zone.bg} ${zone.border}`}>
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-500 mb-0.5">현재 시장</div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-black ${zone.text}`}>{zone.label}</span>
                  <span className="text-sm text-slate-500">
                    {score != null ? `${score.toFixed(1)} / 100` : '— / 100'}
                  </span>
                </div>
              </div>
              {zone.weight != null && (
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase text-slate-500 mb-0.5">권장 주식 비중</div>
                  <div className={`text-3xl font-black ${zone.text}`}>{zone.weight}%</div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-start gap-2 text-[11px] text-slate-500">
            <AlertTriangle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              이 게이지는 종목토론방 게시글 기반 군중심리 모니터링용입니다.
              개별 종목 매매 신호가 아니며, zone에 따른 비중 조정은 캡스톤 §5의 디리스킹 가이드입니다.
              {updatedAt && (
                <span className="ml-1 text-slate-400">
                  · 업데이트 {updatedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ── 5단계 그라데이션 + 마커 ─────────────────────────────────────────────
function ZoneBar({ score }) {
  // 각 zone의 가로 비율 (경계 차이 = 25 / 20 / 10 / 20 / 25 → 100)
  const widths = [25, 20, 10, 20, 25];
  const total = 100;
  const markerLeft = score != null ? `${Math.max(0, Math.min(100, score))}%` : null;

  return (
    <div className="relative w-full">
      <div className="flex w-full h-3 rounded-full overflow-hidden">
        {ANT_INDEX_ZONES.map((z, i) => (
          <div
            key={z.id}
            className="h-full"
            style={{ width: `${(widths[i] / total) * 100}%`, background: z.color }}
            title={`${z.label} (${i === 0 ? '<25' : i === 4 ? '≥75' : `${[0, 25, 45, 55, 75][i]}~${[25, 45, 55, 75, 100][i]}`}) · 비중 ${z.weight}%`}
          />
        ))}
      </div>

      {/* 마커: 현재 점수 위치 */}
      {markerLeft && (
        <div
          className="absolute -top-1 w-0.5 h-5 bg-slate-900 shadow"
          style={{ left: markerLeft }}
          aria-hidden
        />
      )}

      {/* 라벨 */}
      <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-500">
        {ANT_INDEX_ZONES.map(z => (
          <span key={z.id}>{z.label}</span>
        ))}
      </div>
    </div>
  );
}
