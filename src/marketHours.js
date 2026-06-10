// =========================================================================
// 한국 증시 개장 여부 + 마지막 데이터 시점 추정
//   - 정규장: 09:00 ~ 15:30 KST, Mon-Fri
//   - 공휴일은 별도 캘린더 없이 판별 불가 → 휴장일에도 'open'으로 잡힐 수 있음
// =========================================================================

const DAY_MS = 24 * 60 * 60 * 1000;

// KST(Asia/Seoul) 기준 요일(0=Sun..6=Sat) + 분 단위 시간을 사용자 로컬TZ와 무관하게 추출.
function kstParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = parseInt(parts.hour, 10) % 24;  // '24' → 0
  const minute = parseInt(parts.minute, 10);
  return {
    weekday: weekdayMap[parts.weekday],
    minutesOfDay: hour * 60 + minute,
  };
}

const OPEN_MIN  = 9 * 60;          // 09:00
const CLOSE_MIN = 15 * 60 + 30;    // 15:30

export function isMarketOpen(date = new Date()) {
  const { weekday, minutesOfDay } = kstParts(date);
  if (weekday === 0 || weekday === 6) return false;       // 주말
  return minutesOfDay >= OPEN_MIN && minutesOfDay < CLOSE_MIN;
}

// 사용자 로컬TZ와 무관하게 KST 기준 "특정 날짜의 hour:minute KST" 를 가리키는 Date 생성.
// 내부적으로 ISO 문자열 + +09:00 offset 으로 파싱하므로 정확.
function makeKstDateAt(date, hour, minute) {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);   // "YYYY-MM-DD" KST 기준
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return new Date(`${ymd}T${hh}:${mm}:00+09:00`);
}

function kstWeekday(date) {
  return kstParts(date).weekday;
}

// =========================================================================
// lastMarketDataTime — 마지막으로 데이터가 존재할 시점 추정
//
//   - 장중: 현재 시각 그대로 (실시간 적재 진행 중)
//   - 장 외: 가장 최근에 지난 영업일의 15:30 KST
//
// 캔들 fetch 시 `to` 로 사용해서 빈 윈도우(예: 일요일 오후의 now-6h) 회피.
// 휴일 캘린더 미반영이라 실제 휴장일엔 추정이 1일 빗나갈 수 있음.
// =========================================================================
export function lastMarketDataTime(now = new Date()) {
  if (isMarketOpen(now)) return now;

  // 오늘의 15:30 KST 후보. 아직 도래 전이면 (오늘 09:00 이전) 어제로 후퇴.
  let candidate = makeKstDateAt(now, 15, 30);
  if (candidate.getTime() > now.getTime()) {
    candidate = new Date(candidate.getTime() - DAY_MS);
  }

  // 주말이면 평일까지 후퇴 (최대 2일)
  let wd = kstWeekday(candidate);
  while (wd === 0 || wd === 6) {
    candidate = new Date(candidate.getTime() - DAY_MS);
    wd = kstWeekday(candidate);
  }
  return candidate;
}
