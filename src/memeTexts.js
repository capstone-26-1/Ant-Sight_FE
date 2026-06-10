// =========================================================================
// memeTexts.js - 밈 모드(Meme Mode) 텍스트 매핑
//
// 사용법:
//   import { mt } from './memeTexts';
//   mt('theme_alert_title', memeMode)
//   // memeMode=true  → '롱숭이 vs 숏충이'
//   // memeMode=false → '급등락 테마 알림'
//
// 새 밈 추가: MEME_MAP에 key/normal/meme 항목만 추가하면 됩니다.
// =========================================================================

const MEME_MAP = {
  // ── 대시보드 섹션 제목 ──────────────────────────────────────────────
  theme_alert_title: {
    normal: '급등락 테마 알림',
    meme:   '롱숭이 vs 숏충이',
  },
  fear_top5_title: {
    normal: '실시간 비명(공포) TOP 5',
    meme:   '영웅이 호걸이 박먹자',
  },
  greed_top5_title: {
    normal: '실시간 광기(탐욕) TOP 5',
    meme:   '영웅호걸의 시간이다~~',
  },

  // ── 환경설정 알림 항목 ───────────────────────────────────────────────
  alert_scream_title: {
    normal: '껄무새 주의보 (비명 알림)',
    meme:   '껄무새 비상벨 🦜 박먹자 타임!',
  },
  alert_scream_desc: {
    normal: '관심 종목의 공포 지수가 절정에 달했을 때 알림을 받습니다.',
    meme:   '영웅이 호걸이 패닉셀 찍을 때 즉시 카톡드립니다.',
  },
  alert_greed_title: {
    normal: '광기 주의보 (가즈아 알림)',
    meme:   '영웅호걸 출동 알림 🚀 가즈아~~',
  },
  alert_greed_desc: {
    normal: '관심 종목의 탐욕 지수가 임계치를 돌파했을 때 알림을 받습니다.',
    meme:   '종목이 떡상 각 잡힐 때 바로 알려드립니다. 물타기 금지!',
  },
};

/**
 * 밈 모드 여부에 따라 텍스트를 반환합니다.
 *
 * @param {string} key     - MEME_MAP의 키
 * @param {boolean} isMeme - 밈 모드 활성화 여부
 * @returns {string}
 */
export function mt(key, isMeme) {
  const entry = MEME_MAP[key];
  if (!entry) return key; // 키 없으면 키 자체 반환 (안전 장치)
  return isMeme ? entry.meme : entry.normal;
}
