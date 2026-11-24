import axios from 'axios';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  MailCheck,
  Moon,
  PiggyBank,
  Send,
  Sun,
  Wallet,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface LoginLocationState {
  openVerify?: boolean;
  email?: string;
  password?: string;
  previewCode?: string;
  notice?: string;
}

export default function Login() {
  const { login, sendVerificationCode, verifyEmail } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const initialState = (location.state as LoginLocationState | null) ?? null;

  const [mode, setMode] = useState<'signin' | 'verify'>(
    initialState?.openVerify ? 'verify' : 'signin'
  );
  const [email, setEmail] = useState(initialState?.email || '');
  const [password, setPassword] = useState(initialState?.password || '');
  const [verificationCode, setVerificationCode] = useState('');
  const [previewCode, setPreviewCode] = useState<string | null>(
    initialState?.previewCode || null
  );
  const [notice, setNotice] = useState<string | null>(
    initialState?.notice || null
  );
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        const data = err.response.data as {
          requiresVerification?: boolean;
          email?: string;
          verificationPreviewCode?: string;
          error?: string;
        };
        if (data?.requiresVerification) {
          setMode('verify');
          if (data.email) setEmail(data.email);
          setPreviewCode(data.verificationPreviewCode || null);
          setNotice(
            'Your email is not verified yet. Enter the 6-digit verification code below to verify and sign in.'
          );
          return;
        }
      }
      setError(getApiErrorMessage(err, 'Invalid email or password.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendVerification = async () => {
    setError(null);
    setNotice(null);

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter your account password so we can send a verification code.');
      return;
    }

    setSendingCode(true);
    try {
      const res = await sendVerificationCode(email.trim(), password);
      if (res.alreadyVerified) {
        setPreviewCode(null);
        setMode('signin');
        setNotice(res.message);
      } else {
        setPreviewCode(res.verificationPreviewCode || null);
        setNotice(res.message);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send verification code.'));
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifySubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!/^\d{6}$/.test(verificationCode.trim())) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setSubmitting(true);
    try {
      await verifyEmail(email.trim(), verificationCode.trim());
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Verification failed. Please check the code and try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoSignIn = async () => {
    setError(null);
    setNotice(null);
    setDemoLoading(true);
    try {
      await login('demo@example.com', 'password123');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not launch interactive demo.'));
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090B] text-slate-900 dark:text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-colors">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(37,99,235,0.14),_transparent_55%)]" />
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="absolute top-6 right-6 z-10 p-2.5 rounded-xl bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] shadow-xs cursor-pointer"
      >
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400" />
        ) : (
          <Moon className="w-4 h-4 text-blue-600" />
        )}
      </button>

      <div className="max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        {/* Left dimensional showcase */}
        <div className="lg:col-span-6 space-y-6 relative z-10">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/25 flex items-center justify-center text-white">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-blue-600 dark:text-blue-400">
              Multi-Wallet
            </span>
          </Link>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight [text-wrap:balance]">
              Multi-wallet personal finance &amp; budget intelligence.
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg">
              Manage Cash, Bank, and Card wallets, monitor monthly category budgets with live alerts, track savings goals, and export PDF financial reports.
            </p>
          </div>

          <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-800 max-w-lg">
            <div className="flex items-start gap-3">
              <Wallet className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Multi-wallet &amp; instant transfers
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Automatic balance updates across Cash, Bank, Card, and Mobile Wallets.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <PiggyBank className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Monthly budgets &amp; savings goals
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Threshold alerts at 80% and 100% plus goal contribution tracking.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <BarChart3 className="w-5 h-5 text-cyan-500 mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Voice logging, PDF reports &amp; multi-currency
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Switch seamlessly between PKR, USD, EUR, and GBP with Dark/Light modes.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right sign-in & inline email verification panel */}
        <div className="lg:col-span-6 relative z-10">
          <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-2xl shadow-slate-900/5 dark:shadow-black/60 max-w-md mx-auto lg:ml-auto lg:mr-0">
            {/* Inline Mode Switcher directly on Login Form */}
            <div className="grid grid-cols-2 gap-1 p-1 mb-6 bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  mode === 'signin'
                    ? 'bg-white dark:bg-[#1C1C22] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('verify');
                  setError(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  mode === 'verify'
                    ? 'bg-white dark:bg-[#1C1C22] text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
                }`}
              >
                <MailCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Verify Email</span>
              </button>
            </div>

            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {mode === 'signin'
                  ? 'Sign in to Multi-Wallet'
                  : 'Verify your email address'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {mode === 'signin'
                  ? 'Access your wallets, analytics, and monthly budgets.'
                  : 'Request or enter your 6-digit email verification code.'}
              </p>
            </div>

            {notice && (
              <div className="mb-4 px-3.5 py-2.5 text-xs text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{notice}</span>
              </div>
            )}

            {mode === 'verify' && previewCode && (
              <div className="mb-4 px-3.5 py-2.5 text-xs text-blue-800 dark:text-blue-200 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between gap-3">
                <div>
                  <span className="font-semibold">Verification Code: </span>
                  <span className="font-mono font-bold tracking-widest text-sm">
                    {previewCode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setVerificationCode(previewCode)}
                  className="px-2.5 py-1 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shrink-0 cursor-pointer"
                >
                  Autofill
                </button>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mb-5 px-3.5 py-2.5 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl"
              >
                {error}
              </div>
            )}

            {mode === 'signin' ? (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Email address
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Password
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || demoLoading}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-600/25 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <span>{submitting ? 'Signing in...' : 'Sign in'}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>

                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('verify');
                      setError(null);
                    }}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Need to verify your email?
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifySubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="verify-email"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Email address
                  </label>
                  <input
                    id="verify-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="verify-password"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Password (to request/resend code)
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleSendVerification()}
                      disabled={sendingCode || submitting}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="w-3 h-3" />
                      <span>{sendingCode ? 'Sending...' : 'Send / Resend Code'}</span>
                    </button>
                  </div>
                  <input
                    id="verify-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter account password to send code"
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="verify-code"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    6-Digit Verification Code
                  </label>
                  <input
                    id="verify-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) =>
                      setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder="123456"
                    required
                    className="w-full px-3.5 py-2.5 text-base font-mono tracking-[0.35em] text-center text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || demoLoading}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-600/25 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <span>{submitting ? 'Verifying...' : 'Verify Email & Sign In'}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </form>
            )}

            <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleDemoSignIn}
                disabled={submitting || demoLoading}
                className="w-full px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {demoLoading ? 'Launching workspace...' : 'Launch Free Demo Workspace'}
              </button>
            </div>

            <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
              New to Multi-Wallet?{' '}
              <Link
                to="/register"
                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Create account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
