import { AlertTriangle, Zap, Bookmark, Bell, Check, Trash2, X } from 'lucide-react';

// =========================================================================
// NotificationPanel - 알림 패널
//
// App.js에서 fixed 위치로 렌더링됩니다 (어느 페이지에서도 표시).
//
// props:
//   notifications       - 알림 배열
//   onMarkRead          - 특정 알림 읽음 처리 (id → void)
//   onMarkAllRead       - 전체 읽음 처리
//   onClearAll          - 전체 삭제
//   onNavigateToStock   - 알림 클릭 시 해당 종목으로 이동 (stockData → void)
//   onClose             - 패널 닫기
//
// 알림 객체 구조 (서버 연동 시 이 구조로 데이터를 보내주면 됩니다):
//   {
//     id:        1,            // 고유 ID (Date.now() 등)
//     type:      'fear',       // 'fear' | 'greed' | 'bookmark' | 'info'
//     title:     '에코프로',   // 종목명 또는 알림 제목
//     message:   '비명 5단계', // 알림 내용
//     time:      '14:32',      // 알림 시간
//     read:      false,        // 읽음 여부
//     stockData: { ... },      // 클릭 시 이동할 종목 데이터 (없으면 null)
//   }
// =========================================================================
export default function NotificationPanel({
  notifications = [],
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  onNavigateToStock,
  onClose,
}) {
  const unreadCount = notifications.filter(n => !n.read).length;

  // 알림 클릭: 읽음 처리 후 해당 종목으로 이동
  const handleNotificationClick = (notif) => {
    onMarkRead(notif.id);
    if (notif.stockData) {
      onNavigateToStock(notif.stockData);
    }
  };

  // 알림 타입별 아이콘과 색상
  const getNotifStyle = (type) => {
    switch (type) {
      case 'fear':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-blue-500" />,
          bg: 'bg-blue-50',
          border: 'border-blue-100',
        };
      case 'greed':
        return {
          icon: <Zap className="w-5 h-5 text-red-500" />,
          bg: 'bg-red-50',
          border: 'border-red-100',
        };
      case 'bookmark':
        return {
          icon: <Bookmark className="w-5 h-5 text-yellow-500" />,
          bg: 'bg-yellow-50',
          border: 'border-yellow-100',
        };
      default:
        return {
          icon: <Bell className="w-5 h-5 text-slate-500" />,
          bg: 'bg-slate-50',
          border: 'border-slate-100',
        };
    }
  };

  return (
    <>
      {/* 배경 오버레이: 패널 바깥 클릭 시 닫기 */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* 알림 패널 본체 */}
      <div className="fixed top-16 right-4 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 flex flex-col max-h-[80vh]">

        {/* ── 헤더 ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-slate-700" />
            <span className="font-bold text-slate-900">알림</span>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── 일괄 처리 버튼 ── */}
        {notifications.length > 0 && (
          <div className="flex items-center justify-between px-5 py-2 border-b border-slate-100 bg-slate-50/50">
            {/* 전체 읽음 처리 */}
            <button
              onClick={onMarkAllRead}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              전체 읽음
            </button>
            {/* 전체 삭제 */}
            <button
              onClick={onClearAll}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              전체 삭제
            </button>
          </div>
        )}

        {/* ── 알림 목록 ── */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {notifications.length > 0 ? (
            notifications.map((notif) => {
              const style = getNotifStyle(notif.type);
              return (
                <div
                  key={notif.id}
                  // stockData가 있으면 클릭 가능 (종목으로 이동)
                  className={`flex items-start gap-3 px-5 py-4 transition-colors ${
                    notif.stockData
                      ? 'cursor-pointer hover:bg-slate-50'
                      : ''
                  } ${!notif.read ? 'bg-indigo-50/30' : ''}`}
                  onClick={() => notif.stockData && handleNotificationClick(notif)}
                >
                  {/* 아이콘 */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border ${style.bg} ${style.border}`}>
                    {style.icon}
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`font-bold text-sm ${!notif.read ? 'text-slate-900' : 'text-slate-600'}`}>
                        {notif.title}
                      </span>
                      <span className="text-xs text-slate-400 flex-shrink-0">{notif.time}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{notif.message}</p>
                    {/* 종목으로 이동 가능 표시 */}
                    {notif.stockData && (
                      <span className="text-xs text-indigo-500 font-medium mt-1 inline-block">
                        종목 바로가기 →
                      </span>
                    )}
                  </div>

                  {/* 읽지 않음 표시 */}
                  {!notif.read && (
                    <div className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0 mt-1.5" />
                  )}
                </div>
              );
            })
          ) : (
            // 알림이 없을 때
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Bell className="w-10 h-10 mb-3 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">알림이 없습니다.</p>
              <p className="text-xs mt-1 text-center leading-relaxed">
                관심 종목의 여론이 급변하면<br />여기에 알림이 표시됩니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
