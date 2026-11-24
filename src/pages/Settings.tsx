import {
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Languages,
  Moon,
  RotateCcw,
  Sliders,
  Sun,
  X,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import api, { getApiErrorMessage } from '../api/axios';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { useTheme } from '../context/ThemeContext';
import { LANGUAGE_OPTIONS } from '../i18n/translations';
import type { CurrencyCode, FeaturePreferences, LanguageCode, User } from '../types';

const FEATURE_ITEMS: Array<{
  key: keyof FeaturePreferences;
  title: string;
  description: string;
}> = [
  {
    key: 'accountingModule',
    title: 'Accounting Statements & Ledger',
    description:
      'Show Chart of Accounts, Account Ledger, Balance Sheet, Profit & Loss, and Trial Balance in the sidebar.',
  },
  {
    key: 'voiceQuickAdd',
    title: 'Voice Quick-Add Microphone',
    description:
      'Enable browser speech-to-text transaction capture bar on Dashboard and Entry drawer.',
  },
  {
    key: 'budgetAlerts',
    title: 'Monthly Budgets & Threshold Alerts',
    description:
      'Enable Monthly Budgets navigation and budget warning alerts in the top Alerts bell.',
  },
  {
    key: 'savingsGoals',
    title: 'Savings Goals Tracking',
    description:
      'Enable Savings Goals milestones and upcoming goal deadline reminders.',
  },
  {
    key: 'pdfReports',
    title: 'Monthly PDF Financial Reports',
    description:
      'Show PDF financial report export buttons on Dashboard and Expenses Ledger.',
  },
  {
    key: 'overdraftWarning',
    title: 'Overdraft & Negative Balance Guard',
    description:
      'Warn before an expense pushes a wallet negative and surface overdrawn alerts in the header.',
  },
  {
    key: 'keyboardShortcuts',
    title: 'Keyboard Shortcuts (? & G chords)',
    description:
      'Enable quick keyboard navigation shortcuts and the Keyboard Shortcuts sidebar guide.',
  },
];

export default function Settings() {
  const { user, setUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, features, updateFeatureToggle, t } = usePreferences();

  const [name, setName] = useState(user?.name || '');
  const [currency, setCurrency] = useState<CurrencyCode>(user?.currency || 'PKR');
  const [monthlyIncomeGoal, setMonthlyIncomeGoal] = useState(
    String(user?.monthlyIncomeGoal ?? 0)
  );

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [confirmWord, setConfirmWord] = useState('');
  const [resetting, setResetting] = useState(false);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedNotice(null);
    setSaving(true);

    try {
      const res = await api.put<{ user: User }>('/auth/profile', {
        name: name.trim(),
        currency,
        monthlyIncomeGoal: Number(monthlyIncomeGoal) || 0,
      });
      setUser(res.data.user);
      setSavedNotice('Profile and currency settings updated.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to update settings.'));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedNotice(null);

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await api.put<{ message: string }>('/auth/password', {
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setSavedNotice(res.data.message || 'Password updated successfully.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to change password.'));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleResetAllData = async () => {
    if (confirmWord.trim().toUpperCase() !== 'RESET') return;
    setError(null);
    setResetting(true);
    try {
      await api.post('/auth/reset');
      setResetModalOpen(false);
      setConfirmWord('');
      setSavedNotice(
        'All transactions, budgets, goals, and custom wallets have been reset to default starter accounts and categories.'
      );
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to reset account data.'));
    } finally {
      setResetting(false);
    }
  };

  return (
    <Layout title={t('settings.title')} subtitle={t('settings.subtitle')}>
      <div className="max-w-3xl space-y-6">
        {savedNotice && (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
            <Check className="w-4 h-4 shrink-0" />
            <span>{savedNotice}</span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="px-4 py-3 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl"
          >
            {error}
          </div>
        )}

        {/* Language Selector Card (styled like reference screenshot) */}
        <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {t('settings.languageTitle')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('settings.languageDesc')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {LANGUAGE_OPTIONS.map((opt) => {
              const active = language === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => {
                    void setLanguage(opt.code as LanguageCode);
                    setSavedNotice(`Language switched to ${opt.label}.`);
                  }}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/25'
                      : 'bg-white dark:bg-[#09090B] text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-white/[0.1] hover:border-indigo-400'
                  }`}
                >
                  {opt.nativeLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Profile & Currency Settings */}
        <form
          onSubmit={handleSaveProfile}
          className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-sm space-y-5"
        >
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Profile &amp; Currency
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Changing currency dynamically reformats every dashboard KPI, chart, and wallet across the app.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="settings-name"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Full Name
              </label>
              <input
                id="settings-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="settings-email"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Email Address
                </label>
                {user?.emailVerified && (
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Verified
                  </span>
                )}
              </div>
              <input
                id="settings-email"
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-3.5 py-2.5 text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-not-allowed"
              />
            </div>

            <div>
              <label
                htmlFor="settings-currency"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Display Currency
              </label>
              <select
                id="settings-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-full px-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl"
              >
                <option value="PKR">PKR (Pakistani Rupee — Rs)</option>
                <option value="USD">USD (US Dollar — $)</option>
                <option value="EUR">EUR (Euro — €)</option>
                <option value="GBP">GBP (British Pound — £)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="settings-goal"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Monthly Income Goal ({currency})
              </label>
              <input
                id="settings-goal"
                type="number"
                min="0"
                step="100"
                value={monthlyIncomeGoal}
                onChange={(e) => setMonthlyIncomeGoal(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-xl hover:from-indigo-500 hover:to-indigo-400 shadow-md shadow-indigo-600/25 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        {/* Change Password Card */}
        <form
          onSubmit={handleChangePassword}
          className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-sm space-y-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  {t('settings.passwordTitle')}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t('settings.passwordDesc')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPasswords((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              {showPasswords ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Hide</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Show</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="pw-current"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Current Password
              </label>
              <input
                id="pw-current"
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl"
              />
            </div>

            <div>
              <label
                htmlFor="pw-new"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                New Password
              </label>
              <input
                id="pw-new"
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl"
              />
            </div>

            <div>
              <label
                htmlFor="pw-confirm"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Confirm New Password
              </label>
              <input
                id="pw-confirm"
                type={showPasswords ? 'text' : 'password'}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl"
              />
            </div>
          </div>

          <div className="pt-1 flex justify-end">
            <button
              type="submit"
              disabled={changingPassword}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 rounded-xl cursor-pointer disabled:opacity-50"
            >
              {changingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>

        {/* Customize Features ON/OFF Card */}
        <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {t('settings.featuresTitle')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('settings.featuresDesc')}
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {FEATURE_ITEMS.map((item) => {
              const enabled = features[item.key];
              return (
                <div
                  key={item.key}
                  className="py-3.5 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      {item.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={item.title}
                    onClick={() => void updateFeatureToggle(item.key, !enabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                      enabled
                        ? 'bg-indigo-600'
                        : 'bg-slate-300 dark:bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Appearance Card */}
        <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Appearance Theme
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Choose between Dark Obsidian and Crisp Light interface modes.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 max-w-sm">
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold cursor-pointer transition-all ${
                theme === 'dark'
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Moon className="w-4 h-4" />
              <span>Dark Mode</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold cursor-pointer transition-all ${
                theme === 'light'
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>Light Mode</span>
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Reset All Account Data</span>
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Permanently deletes all transactions, budgets, savings goals, and restores default Cash &amp; Bank wallets.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setResetModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset All Data</span>
          </button>
        </div>
      </div>

      {resetModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-rose-600 dark:text-rose-400">
                Confirm Account Reset
              </h2>
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                This action will delete all transactions, monthly budgets, savings goals, and custom wallets for your account. Type{' '}
                <strong className="font-mono text-rose-600 dark:text-rose-400">
                  RESET
                </strong>{' '}
                to proceed.
              </p>

              <input
                type="text"
                value={confirmWord}
                onChange={(e) => setConfirmWord(e.target.value)}
                placeholder="Type RESET"
                className="w-full px-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl"
              />

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setResetModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={confirmWord.trim().toUpperCase() !== 'RESET' || resetting}
                  onClick={() => void handleResetAllData()}
                  className="px-5 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 rounded-xl cursor-pointer"
                >
                  {resetting ? 'Resetting...' : 'Erase & Reset'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
