// =========================================================================
// dummyData.js - 개발용 테스트 더미 데이터
//
// 서버 연동 전 UI 확인을 위한 가짜 데이터 모음입니다.
// 테스트 모드(devTestMode)가 ON일 때만 사용됩니다.
// 서버 연동 후에는 이 파일을 참고하여 실제 API 응답 구조를 설계하세요.
// =========================================================================


// ── DashBoardScreen에 전달되는 데이터 ────────────────────────────────────
// dashboardData 구조:
//   lastUpdated  - 마지막 업데이트 시각 문자열
//   themeAlerts  - 급등락 테마 알림 배열
//   fearTop5     - 공포 상위 5개 종목
//   greedTop5    - 탐욕 상위 5개 종목
export const dummyDashboardData = {
  lastUpdated: '15:30',
  themeAlerts: [
    { id: 1, theme: '2차전지',    level: '비명 주의보', desc: '커뮤니티 내 공포 심리 급증. 손절 언급 +340%', type: 'fear'  },
    { id: 2, theme: 'AI 반도체',  level: '광기 경보',   desc: '가즈아 밈 게시물 폭발적 증가. 과열 신호', type: 'greed' },
    { id: 3, theme: '바이오',     level: '비명 경보',   desc: '임상 실패 루머로 패닉셀 급증 감지',         type: 'fear'  },
    { id: 4, theme: '조선·방산',  level: '광기 주의보', desc: '수주 기대감으로 긍정 커뮤니티 여론 급상승', type: 'greed' },
    { id: 5, theme: '리츠·배당',  level: '중립',        desc: '금리 동결 기대감에 커뮤니티 관망 분위기',  type: 'fear'  },
    { id: 6, theme: '게임',       level: '광기 주의보', desc: '신작 출시 기대로 매수 언급 폭증',           type: 'greed' },
  ],
  fearTop5: [
    { rank: 1, name: '에코프로비엠', ticker: '247540', price: 87500,  change: '-8.32%', score: -92 },
    { rank: 2, name: '카카오',       ticker: '035720', price: 38200,  change: '-4.71%', score: -81 },
    { rank: 3, name: '셀트리온',     ticker: '068270', price: 154000, change: '-3.50%', score: -74 },
    { rank: 4, name: 'SK이노베이션', ticker: '096770', price: 98100,  change: '-2.90%', score: -67 },
    { rank: 5, name: '포스코퓨처엠', ticker: '003670', price: 192500, change: '-2.10%', score: -61 },
  ],
  greedTop5: [
    { rank: 1, name: 'HD현대중공업', ticker: '329180', price: 218000, change: '+9.80%', score: 94 },
    { rank: 2, name: 'SK하이닉스',   ticker: '000660', price: 189500, change: '+5.43%', score: 88 },
    { rank: 3, name: '한화에어로스페이스', ticker: '012450', price: 312000, change: '+4.20%', score: 79 },
    { rank: 4, name: 'NAVER',        ticker: '035420', price: 184000, change: '+3.10%', score: 71 },
    { rank: 5, name: '삼성전자',     ticker: '005930', price: 74800,  change: '+2.30%', score: 62 },
  ],
};


// ── MarketAnalysisScreen에 전달되는 데이터 ───────────────────────────────
// analysisData 구조:
//   antIndex     - 전체 시장 개미 지수 (-100 ~ 100)
//   lastUpdated  - 마지막 분석 시각
//   aiSummary    - AI 분석 요약 텍스트
//   sectors      - 섹터별 감성 지수 배열
export const dummyAnalysisData = {
  antIndex: -68,
  lastUpdated: '15:30',
  aiSummary:
    '현재 시장은 전반적인 공포 구간에 진입했습니다. ' +
    '2차전지 및 바이오 섹터를 중심으로 패닉셀 언급이 급증하고 있으며, ' +
    '개인 투자자들의 손절 비중이 평균 대비 2.4배 높은 상황입니다. ' +
    '반면 조선·방산 섹터는 수주 기대감을 바탕으로 탐욕 구간을 유지하고 있어 ' +
    '섹터 간 괴리가 극명합니다. 과거 유사 패턴에서는 공포 절정 후 단기 반등이 ' +
    '나타난 사례가 많으나, 매크로 불확실성이 해소되지 않아 신중한 접근이 필요합니다.',
  sectors: [
    { name: '반도체',    score: -45, trend: '하락세 지속 — 외국인 매도 집중' },
    { name: '2차전지',   score: -88, trend: '극단적 공포 — 패닉셀 급증' },
    { name: '바이오',    score: -62, trend: '공포 구간 — 루머 확산 중' },
    { name: 'AI·소프트웨어', score: 34, trend: '중립(강세) — 실적 기대감' },
    { name: '조선·방산', score: 79, trend: '탐욕 구간 — 수주 기대' },
    { name: '리츠·배당', score: -18, trend: '중립(약세) — 금리 관망' },
    { name: '게임',      score: 55, trend: '탐욕 구간 — 신작 기대' },
    { name: '금융·은행', score: 12, trend: '중립 — 금리 수혜 기대' },
  ],
};


// ── ExplorePageScreen에 전달되는 데이터 ─────────────────────────────────
// exploreData 구조:
//   trendingSearches  - 실시간 인기 검색어 배열
//   antIndexRankings  - 개미 지수 순위 배열
export const dummyExploreData = {
  trendingSearches: [
    '에코프로', 'SK하이닉스', '삼성전자', 'NAVER', '카카오',
    '한화에어로', 'HD현대중공업', '셀트리온', '포스코퓨처엠', 'LG에너지솔루션',
  ],
  antIndexRankings: [
    { rank: 1,  name: 'HD현대중공업',      ticker: '329180', price: 218000, change: '+9.80%', score: 94,  isDown: false, changeAmount: 19400  },
    { rank: 2,  name: 'SK하이닉스',        ticker: '000660', price: 189500, change: '+5.43%', score: 88,  isDown: false, changeAmount: 9750   },
    { rank: 3,  name: '한화에어로스페이스', ticker: '012450', price: 312000, change: '+4.20%', score: 79,  isDown: false, changeAmount: 12580  },
    { rank: 4,  name: 'NAVER',             ticker: '035420', price: 184000, change: '+3.10%', score: 71,  isDown: false, changeAmount: 5540   },
    { rank: 5,  name: '삼성전자',          ticker: '005930', price: 74800,  change: '+2.30%', score: 62,  isDown: false, changeAmount: 1680   },
    { rank: 6,  name: 'SK이노베이션',      ticker: '096770', price: 98100,  change: '-2.90%', score: -67, isDown: true,  changeAmount: -2930  },
    { rank: 7,  name: '포스코퓨처엠',      ticker: '003670', price: 192500, change: '-2.10%', score: -61, isDown: true,  changeAmount: -4130  },
    { rank: 8,  name: '셀트리온',          ticker: '068270', price: 154000, change: '-3.50%', score: -74, isDown: true,  changeAmount: -5600  },
    { rank: 9,  name: '카카오',            ticker: '035720', price: 38200,  change: '-4.71%', score: -81, isDown: true,  changeAmount: -1880  },
    { rank: 10, name: '에코프로비엠',      ticker: '247540', price: 87500,  change: '-8.32%', score: -92, isDown: true,  changeAmount: -7940  },
  ],
};
