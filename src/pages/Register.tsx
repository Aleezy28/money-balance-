import { ArrowRight, CheckCircle2, Moon, Sun } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { CurrencyCode } from '../types';

export default function Register() {
  const { register } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('PKR');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError('Please enter your name (at least 2 characters).');
      return;
    }
    if (!email.trim()) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await register(name.trim(), email.trim(), password, currency);
      navigate('/login', {
        replace: true,
        state: {
          openVerify: true,
          email: result.email,
          password,
          previewCode: result.verificationPreviewCode,
          notice: result.message,
        },
      });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to create account.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090B] text-slate-900 dark:text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-colors">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(99,102,241,0.14),_transparent_55%)]" />
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="absolute top-6 right-6 z-10 p-2.5 rounded-xl bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] shadow-xs cursor-pointer"
      >
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400" />
        ) : (
          <Moon className="w-4 h-4 text-indigo-600" />
        )}
      </button>

      <div className="max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        <div className="lg:col-span-6 space-y-6">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/25 flex items-center justify-center text-white font-bold text-sm">
              MW
            </div>
            <span className="text-xl font-extrabold tracking-tight text-blue-600 dark:text-blue-400">
              Multi-Wallet
            </span>
          </Link>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight [text-wrap:balance]">
              Launch your personal finance workspace in seconds.
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg">
              Your new account automatically provisions starter wallets and 8 income &amp; expense categories so you can track every rupee or dollar immediately.
            </p>
          </div>

          <ul className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800 max-w-lg text-sm text-slate-700 dark:text-slate-300">
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />
              <span>Auto-created Cash &amp; Bank Account wallets</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />
              <span>8 starter categories with icons &amp; color coding</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />
              <span>Monthly category budgets, savings goals &amp; CSV import/export</span>
            </li>
          </ul>
        </div>

        <div className="lg:col-span-6 relative z-10">
          <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-2xl shadow-slate-900/5 dark:shadow-black/60 max-w-md mx-auto lg:ml-auto lg:mr-0">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Create account
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Configure your profile and preferred currency.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-5 px-3.5 py-2.5 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="reg-name"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Full name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Morgan"
                  required
                  className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="reg-email"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Email address
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reg-currency"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Currency
                  </label>
                  <select
                    id="reg-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                    className="w-full px-3 py-2.5 text-sm font-mono text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="PKR">PKR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="reg-password"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Password
                </label>
                <input
                  id="reg-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  minLength={6}
                  required
                  className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-confirm"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Confirm password
                </label>
                <input
                  id="reg-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  minLength={6}
                  required
                  className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-xl hover:from-indigo-500 hover:to-indigo-400 shadow-md shadow-indigo-600/25 disabled:opacity-50 transition-all cursor-pointer"
              >
                <span>{submitting ? 'Creating workspace...' : 'Create account'}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
