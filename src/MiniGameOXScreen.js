import { useState, useEffect } from 'react';
import { Bell, CheckCircle2, XCircle, BookOpen, ChevronRight } from 'lucide-react';
import Sidebar from './Sidebar';
import quizData from './OX_quiz.json';

// =========================================================================
// MiniGameOXScreen - OX 퀴즈 미니게임
//
// 동작 방식:
//   - localStorage('antsight_ox_solved')에 이미 푼 문제 ID 배열을 저장
//   - 안 푼 문제 중 첫 번째를 순서대로 표시 (무작위 X)
//   - O / X 버튼 클릭 → 결과 모달(정답 여부 + 해설) 표시
//   - 모달 닫기 → 다음 안 푼 문제로 이동
//   - 전체 완료 시 → 완료 화면 + 초기화 버튼
//
// props:
//   currentPage          - 현재 페이지 이름
//   onNavigate           - 페이지 이동 함수
//   unreadCount          - 읽지 않은 알림 수
//   onToggleNotifications - 알림 패널 토글
// =========================================================================
export default function MiniGameOXScreen({
  currentPage,
  onNavigate,
  unreadCount = 0,
  onToggleNotifications,
}) {
  // ── 푼 문제 ID 목록: localStorage에서 초기 로드 ─────────────────────
  // lazy initializer: 첫 렌더링 시 한 번만 실행됨
  const [solvedIds, setSolvedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('antsight_ox_solved');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 결과 모달 상태
  // null = 닫힘 / { isCorrect, answer, desc } = 열림
  const [modal, setModal] = useState(null);

  // ── 안 푼 문제 목록 계산 ─────────────────────────────────────────────
  const unsolvedList = quizData.filter(q => !solvedIds.includes(q.id));
  const currentQuiz  = unsolvedList[0] ?? null;

  // ── 전체 소진 시 조용히 자동 초기화 ──────────────────────────────────
  useEffect(() => {
    if (quizData.length > 0 && solvedIds.length >= quizData.length) {
      setSolvedIds([]);
      localStorage.removeItem('antsight_ox_solved');
    }
  }, [solvedIds]);

  // ── 답변 처리 ─────────────────────────────────────────────────────────
  // userAnswer: true(O 선택) / false(X 선택)
  const handleAnswer = (userAnswer) => {
    if (!currentQuiz || modal) return; // 모달 열린 상태면 중복 클릭 무시

    const isCorrect = userAnswer === currentQuiz.answer;

    // 정답/오답 무관하게 이 문제는 '푼 문제'로 등록
    const newSolvedIds = [...solvedIds, currentQuiz.id];
    setSolvedIds(newSolvedIds);
    localStorage.setItem('antsight_ox_solved', JSON.stringify(newSolvedIds));

    // 해설 모달 열기
    setModal({
      isCorrect,
      answer: currentQuiz.answer,
      desc:   currentQuiz.desc,
    });
  };

  // ── 모달 닫기 (= 다음 문제로 이동) ───────────────────────────────────
  const handleCloseModal = () => setModal(null);


  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">

      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />

      <main className="flex-1 flex flex-col h-screen overflow-y-auto">

        {/* 상단 헤더 */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-indigo-500" />
            <span className="text-lg font-bold text-slate-900">OX 퀴즈</span>
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

        {/* 메인 콘텐츠: 수직/수평 가운데 정렬 */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">

          {/* auto-reset 중 currentQuiz가 잠깐 null일 수 있으므로 null 가드 */}
          {currentQuiz && (
            <div className="w-full max-w-xl">

              {/* 문제 카드 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 mb-6">
                <div className="inline-flex items-center bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-1.5 rounded-full border border-indigo-100 mb-5">
                  Q.
                </div>

                <p className="text-xl font-bold text-slate-900 leading-relaxed text-center min-h-[5rem] flex items-center justify-center">
                  {currentQuiz.question}
                </p>
              </div>

              {/* O / X 선택 버튼 */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleAnswer(true)}
                  className="group flex flex-col items-center justify-center gap-2 bg-white border-2 border-red-200 rounded-2xl p-8 hover:bg-red-50 hover:border-red-400 hover:shadow-md transition-all active:scale-95"
                >
                  <span className="text-7xl leading-none font-black text-red-400 group-hover:text-red-500 transition-colors select-none">
                    O
                  </span>
                  <span className="text-sm font-bold text-red-400 group-hover:text-red-500 transition-colors">
                    맞다
                  </span>
                </button>

                <button
                  onClick={() => handleAnswer(false)}
                  className="group flex flex-col items-center justify-center gap-2 bg-white border-2 border-blue-200 rounded-2xl p-8 hover:bg-blue-50 hover:border-blue-400 hover:shadow-md transition-all active:scale-95"
                >
                  <span className="text-7xl leading-none font-black text-blue-400 group-hover:text-blue-500 transition-colors select-none">
                    X
                  </span>
                  <span className="text-sm font-bold text-blue-400 group-hover:text-blue-500 transition-colors">
                    틀리다
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── 결과 모달: fixed로 최상위에 렌더링 ── */}
      {modal && (
        <ResultModal
          isCorrect={modal.isCorrect}
          answer={modal.answer}
          desc={modal.desc}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}


// =========================================================================
// ResultModal - O/X 선택 후 표시되는 결과 + 해설 모달
//
// props:
//   isCorrect - 사용자가 정답을 맞혔는지
//   answer    - 실제 정답 (true = O, false = X)
//   desc      - 해설 텍스트
//   onClose   - 닫기 / 다음 문제로
// =========================================================================
function ResultModal({ isCorrect, answer, desc, onClose }) {
  return (
    // 반투명 배경: 클릭 시 모달 닫기
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      {/* 모달 본체: 클릭 이벤트 부모로 전파 차단 */}
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 정답/오답 아이콘 + 제목 */}
        <div className="flex flex-col items-center mb-6">
          {isCorrect
            ? <CheckCircle2 className="w-16 h-16 text-green-500 mb-3" />
            : <XCircle     className="w-16 h-16 text-red-400   mb-3" />
          }
          <h3 className={`text-2xl font-extrabold ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
            {isCorrect ? '정답입니다!' : '오답입니다!'}
          </h3>

          {/* 실제 정답 표시 */}
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            정답:&nbsp;
            <span className={`text-xl font-black ${answer ? 'text-red-500' : 'text-blue-500'}`}>
              {answer ? 'O' : 'X'}
            </span>
          </div>
        </div>

        {/* 해설 박스 */}
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 mb-6">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">해설</p>
          <p className="text-slate-800 leading-relaxed text-sm">{desc}</p>
        </div>

        {/* 다음 문제 버튼 */}
        <button
          onClick={onClose}
          className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 transition-colors"
        >
          다음 문제 <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}


