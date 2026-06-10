import { useState } from 'react';
import { Eye, EyeOff, User, Lock, Mail, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { authApi } from './api/auth';

// =========================================================================
// AuthScreen - 로그인 / 회원가입 / 게스트 진입 화면
//
// props:
//   onLogin(user)  - 로그인/회원가입 성공 시 호출. user = { type, username, email }
//   onGuest()      - 게스트로 시작 시 호출
// =========================================================================
export default function AuthScreen({ onLogin, onGuest }) {
  const [tab, setTab] = useState('login'); // 'login' | 'signup'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex items-center justify-center p-4">

      {/* 배경 장식 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500 rounded-full blur-[120px] opacity-20" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500 rounded-full blur-[120px] opacity-15" />
      </div>

      <div className="relative w-full max-w-md">

        {/* 로고 영역 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg shadow-indigo-900/50">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">AntSight</h1>
          <p className="text-slate-400 mt-1 text-sm">개미들의 진짜 심리를 읽는 투자 분석 플랫폼</p>
        </div>

        {/* 카드 */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">

          {/* 탭 */}
          <div className="flex bg-white/5 p-1 rounded-xl mb-6">
            <button
              onClick={() => setTab('login')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                tab === 'login'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              로그인
            </button>
            <button
              onClick={() => setTab('signup')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                tab === 'signup'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              회원가입
            </button>
          </div>

          {tab === 'login'
            ? <LoginForm onLogin={onLogin} />
            : <SignupForm onSwitchToLogin={() => setTab('login')} />
          }

          {/* 구분선 */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-slate-500">또는</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* 게스트 로그인 */}
          <button
            onClick={onGuest}
            className="w-full py-3 rounded-xl border border-white/15 text-slate-300 text-sm font-bold hover:bg-white/5 hover:text-white hover:border-white/25 transition-all flex items-center justify-center gap-2"
          >
            <User className="w-4 h-4" />
            게스트로 시작하기
          </button>
          <p className="text-center text-xs text-slate-600 mt-2">
            일부 기능이 제한됩니다. 언제든 로그인으로 전환 가능합니다.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LoginForm
// ─────────────────────────────────────────────────────────────────────────
function LoginForm({ onLogin }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 모두 입력하세요.');
      return;
    }

    setLoading(true);
    try {
      const data = await authApi.login(email.trim(), password);
      localStorage.setItem('antsight_token', data.token);
      onLogin({
        type: 'user',
        username: data.nickname,
        email: data.email,
        userId: data.userId,
        role: data.role,
      });
    } catch (err) {
      setError(err.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <InputField
        icon={<Mail className="w-4 h-4" />}
        type="email"
        placeholder="이메일"
        value={email}
        onChange={e => setEmail(e.target.value)}
        autoComplete="email"
      />
      <InputField
        icon={<Lock className="w-4 h-4" />}
        type={showPw ? 'text' : 'password'}
        placeholder="비밀번호"
        value={password}
        onChange={e => setPassword(e.target.value)}
        autoComplete="current-password"
        suffix={
          <button type="button" onClick={() => setShowPw(v => !v)} className="text-slate-500 hover:text-slate-300">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        }
      />

      {error && <ErrorMsg text={error} />}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition-colors text-sm"
      >
        {loading ? '확인 중...' : '로그인'}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SignupForm
// ─────────────────────────────────────────────────────────────────────────
function SignupForm({ onSwitchToLogin }) {
  const [nickname,   setNickname]   = useState('');
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [showPw,     setShowPw]     = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState(false);
  const [loading,    setLoading]    = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!nickname.trim() || !email.trim() || !password || !confirm) {
      setError('모든 항목을 입력하세요.');
      return;
    }
    if (nickname.trim().length < 2 || nickname.trim().length > 50) {
      setError('닉네임은 2~50자로 입력하세요.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('올바른 이메일 형식을 입력하세요.');
      return;
    }
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    try {
      await authApi.signup(email.trim(), password, nickname.trim());
      setSuccess(true);
      setTimeout(() => onSwitchToLogin(), 1500);
    } catch (err) {
      setError(err.message || '회원가입 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center py-8 gap-3 text-center">
        <CheckCircle className="w-12 h-12 text-green-400" />
        <p className="text-white font-bold text-lg">회원가입 완료!</p>
        <p className="text-slate-400 text-sm leading-relaxed">
          잠시 후 로그인 화면으로 이동합니다.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <InputField
        icon={<User className="w-4 h-4" />}
        type="text"
        placeholder="닉네임 (2~50자)"
        value={nickname}
        onChange={e => setNickname(e.target.value)}
        autoComplete="nickname"
      />
      <InputField
        icon={<Mail className="w-4 h-4" />}
        type="email"
        placeholder="이메일"
        value={email}
        onChange={e => setEmail(e.target.value)}
        autoComplete="email"
      />
      <InputField
        icon={<Lock className="w-4 h-4" />}
        type={showPw ? 'text' : 'password'}
        placeholder="비밀번호 (8자 이상)"
        value={password}
        onChange={e => setPassword(e.target.value)}
        autoComplete="new-password"
        suffix={
          <button type="button" onClick={() => setShowPw(v => !v)} className="text-slate-500 hover:text-slate-300">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        }
      />
      <InputField
        icon={<Lock className="w-4 h-4" />}
        type={showPw ? 'text' : 'password'}
        placeholder="비밀번호 확인"
        value={confirm}
        onChange={e => setConfirm(e.target.value)}
        autoComplete="new-password"
      />

      {error && <ErrorMsg text={error} />}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition-colors text-sm"
      >
        {loading ? '처리 중...' : '회원가입'}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 공통 서브컴포넌트
// ─────────────────────────────────────────────────────────────────────────
function InputField({ icon, suffix, ...inputProps }) {
  return (
    <div className="relative flex items-center">
      <span className="absolute left-3.5 text-slate-500">{icon}</span>
      <input
        {...inputProps}
        className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-500 rounded-xl py-3 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
      />
      {suffix && <span className="absolute right-3.5">{suffix}</span>}
    </div>
  );
}

function ErrorMsg({ text }) {
  return (
    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl px-3 py-2.5">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      {text}
    </div>
  );
}
