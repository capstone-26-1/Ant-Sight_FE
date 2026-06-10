// =========================================================================
// strategies/antIndexSignal.js — AntModel 종목별 의견
//
// 룰 (llm_rules.json.ant_index_strategy):
//   1) 시장 zone 에 따라 권장 주식 비중 결정 (weight_by_zone)
//   2) 화이트리스트 55종목은 "백테스트 universe" — 백테스트 결과의 신뢰도
//      판단 기준일 뿐, 의견 제공 자체는 개미지수 데이터가 있는 모든 종목에 대해 수행.
//   3) (장래) voljump_alert ≥ 0.4 → 신규 진입 회피
//
// 종목 단위 BUY/HOLD 결정은 본 룰의 영역이 아님 — 비중 가이드만 제시.
// =========================================================================
import WHITELIST from '../data/whitelist.json';
import LLM_RULES from '../data/llm_rules.json';
import { getAntIndexZone } from '../api/antIndex';

const WHITELIST_SET = new Set(WHITELIST.map(w => w.ticker));
const WEIGHT_BY_ZONE_LABEL = LLM_RULES.ant_index_strategy?.rules?.weight_by_zone ?? {};

/**
 * @param {string} ticker
 * @param {number|null} marketScore  - 시장 단위 개미지수 (MarketZoneGauge 와 동일 산출)
 * @param {{ score?: number|string, sentiment?: string, postCount?: number, timestamp?: string }|null} antLatest
 *        - 종목별 최신 개미지수 (없으면 null) — 의견 제공 여부의 핵심 입력
 * @param {{ severity?: 'HIGH'|'MEDIUM'|'LOW'|null, status?: string, jumpProb?: number }|null} voljumpDetail
 *        - Model B 변동성 점프 경보. severity='HIGH' 면 rules.exclude_voljump_alert 발동.
 * @returns {{
 *   hasData: boolean,
 *   inBacktestUniverse: boolean,
 *   zone: ReturnType<typeof getAntIndexZone>,
 *   recommendedWeight: number|null,   // voljump HIGH 일 때 0 으로 오버라이드됨
 *   baseWeight: number|null,          // voljump 적용 전 원본 비중 (UI 비교 표시용)
 *   tickerScore: number|null,
 *   tickerZone: ReturnType<typeof getAntIndexZone>|null,
 *   voljumpExcluded: boolean,         // HIGH 로 신규 진입 제외 적용 여부
 *   voljumpSeverity: string|null,
 *   reason: string,
 * }}
 */
export function evaluateAntIndex(ticker, marketScore, antLatest, voljumpDetail = null) {
    const inBacktestUniverse = WHITELIST_SET.has(ticker);
    const zone = getAntIndexZone(marketScore);
    const zoneWeight = WEIGHT_BY_ZONE_LABEL[zone.label];
    const baseWeight = zoneWeight != null ? zoneWeight : null;

    const tickerScore = antLatest?.score != null ? Number(antLatest.score) : null;
    const tickerZone  = tickerScore != null ? getAntIndexZone(tickerScore) : null;
    const hasData     = tickerScore != null;

    // ant_index_strategy.rules.exclude_voljump_alert: severity HIGH 면 신규 진입 회피.
    const voljumpSeverity = voljumpDetail?.status === 'VALID' ? (voljumpDetail?.severity ?? null) : null;
    const voljumpExcluded = voljumpSeverity === 'HIGH';
    const recommendedWeight = voljumpExcluded ? 0 : baseWeight;

    let reason;
    if (!hasData) {
        reason = '이 종목의 개미지수가 아직 수집되지 않았습니다. (수집 대기 중)';
    } else if (baseWeight == null) {
        reason = `종목 개미지수 ${tickerScore.toFixed(1)} (${tickerZone?.label}). 시장 zone 데이터 부족 — 비중 산출 보류.`;
    } else {
        const tickerHint = tickerZone?.label === zone.label
            ? '시장과 동조'
            : `종목은 ${tickerZone?.label} (시장: ${zone.label})`;
        const universeHint = inBacktestUniverse
            ? '백테스트 55 universe 종목 — 디리스킹 전략 직접 적용 검증됨.'
            : '백테스트 universe 외 종목 — 비중 가이드는 동일하나 전략 백테스트 결과엔 미포함.';
        const baseDesc = `종목 개미지수 ${tickerScore.toFixed(1)} (${tickerHint}). 시장 zone = ${zone.label} → 권장 비중 ${Math.round(baseWeight * 100)}%.`;
        if (voljumpExcluded) {
            const probTxt = voljumpDetail?.jumpProb != null
                ? ` (${(voljumpDetail.jumpProb * 100).toFixed(1)}%)`
                : '';
            reason = `${baseDesc} 단, Model B 변동성 점프 경보 HIGH${probTxt} — 신규 진입 회피 (권장 비중 0%로 오버라이드). ${universeHint}`;
        } else if (voljumpSeverity === 'MEDIUM') {
            reason = `${baseDesc} 변동성 경보 MEDIUM — 주의 권고 (비중 유지). ${universeHint}`;
        } else {
            reason = `${baseDesc} ${universeHint}`;
        }
    }

    return {
        hasData,
        inBacktestUniverse,
        zone,
        recommendedWeight,
        baseWeight,
        tickerScore,
        tickerZone,
        voljumpExcluded,
        voljumpSeverity,
        reason,
    };
}
