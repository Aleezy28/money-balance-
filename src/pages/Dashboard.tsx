import {
  AreaChart,
  BadgeDelta,
  BarList,
  Card,
  DonutChart,
  Metric,
  ProgressBar,
  type Color,
  type DeltaType,
} from '@tremor/react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  FileDown,
  Mic,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Square,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import api, { getApiErrorMessage } from '../api/axios';
import { CategoryIcon } from '../components/CategoryIcon';
import Layout from '../components/Layout';
import TransactionModal from '../components/TransactionModal';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { useVoiceInput } from '../hooks/useVoiceInput';
import type {
  Account,
  AnalyticsResponse,
  Category,
  WorkspaceAlert,
} from '../types';
import {
  formatCompactCurrency,
  formatCurrency,
  formatDayHeading,
  formatDisplayDate,
  formatLoggedTime,
  MONTH_OPTIONS,
  toInputDateValue,
} from '../utils/formatCurrency';
import { downloadMonthlyPdfReport } from '../utils/generatePdfReport';
import {
  parseVoiceTransaction,
  type ParsedVoiceTransaction,
} from '../utils/parseVoiceTransaction';

const bentoContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const bentoItemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 320, damping: 28 },
  },
};

const TREMOR_CATEGORY_COLORS: Color[] = [
  'indigo',
  'emerald',
  'cyan',
  'amber',
  'rose',
  'violet',
  'blue',
  'teal',
  'orange',
  'fuchsia',
];

function resolveDeltaType(pct: number | null): DeltaType {
  if (pct === null || Math.abs(pct) < 0.05) return 'unchanged';
  if (pct >= 15) return 'increase';
  if (pct > 0) return 'moderateIncrease';
  if (pct <= -15) return 'decrease';
  return 'moderateDecrease';
}

function roundTwo(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export default function Dashboard() {
  const { currency, user } = useAuth();
  const { features, t } = usePreferences();
  const now = useMemo(() => new Date(), []);

  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());

  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [alerts, setAlerts] = useState<WorkspaceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txInitialTranscript, setTxInitialTranscript] = useState('');
  const [txInitialParsed, setTxInitialParsed] = useState<ParsedVoiceTransaction | null>(null);
  const [quickText, setQuickText] = useState('');
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiParsing, setAiParsing] = useState(false);
  const [quickNotice, setQuickNotice] = useState<string | null>(null);
  const [curveMode, setCurveMode] = useState<'cumulative' | 'daily'>('cumulative');
  const [planTab, setPlanTab] = useState<'budgets' | 'goals'>('budgets');
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfMessage, setPdfMessage] = useState<string | null>(null);

  const {
    isSupported: voiceSupported,
    isListening: quickListening,
    voiceError: quickVoiceError,
    startListening: startQuickVoice,
    stopListening: stopQuickVoice,
    resetTranscript: resetQuickVoice,
  } = useVoiceInput({
    onTranscriptUpdate: (spoken) => {
      setQuickText(spoken);
    },
    onTranscriptFinal: (spoken) => {
      setQuickText(spoken);
    },
  });

  const parsedQuick = useMemo(
    () => parseVoiceTransaction(quickText, accounts, categories),
    [quickText, accounts, categories]
  );

  const resolvedQuickAccount = useMemo(() => {
    const matched = accounts.find((a) => String(a.id) === parsedQuick.accountId);
    if (matched) return matched;
    if (parsedQuick.type === 'INCOME') return accounts[0];
    return [...accounts].sort((a, b) => b.balance - a.balance)[0];
  }, [accounts, parsedQuick.accountId, parsedQuick.type]);

  const resolvedQuickToAccount = useMemo(
    () =>
      accounts.find(
        (a) =>
          String(a.id) === parsedQuick.toAccountId &&
          a.id !== resolvedQuickAccount?.id
      ) || accounts.find((a) => a.id !== resolvedQuickAccount?.id),
    [accounts, parsedQuick.toAccountId, resolvedQuickAccount]
  );

  const resolvedQuickCategory = useMemo(() => {
    const targetType = parsedQuick.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
    return (
      categories.find((c) => String(c.id) === parsedQuick.categoryId) ||
      categories.find((c) => c.type === targetType)
    );
  }, [categories, parsedQuick.categoryId, parsedQuick.type]);

  const yearOptions = useMemo(() => {
    const base = now.getFullYear();
    return [base - 2, base - 1, base, base + 1];
  }, [now]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [analyticsRes, accRes, catRes, alertsRes] = await Promise.all([
        api.get<AnalyticsResponse>('/analytics', { params: { month, year } }),
        api.get<{ accounts: Account[] }>('/accounts'),
        api.get<{ categories: Category[] }>('/categories'),
        api.get<{ alerts: WorkspaceAlert[] }>('/analytics/alerts'),
      ]);
      setAnalytics(analyticsRes.data);
      setAccounts(accRes.data.accounts);
      setCategories(catRes.data.categories);
      setAlerts(alertsRes.data.alerts || []);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load dashboard analytics.'));
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    let active = true;
    api
      .get<{ configured: boolean }>('/ai/status')
      .then((res) => {
        if (active) setAiConfigured(Boolean(res.data?.configured));
      })
      .catch(() => {
        if (active) setAiConfigured(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleDownloadPdf = async () => {
    setPdfDownloading(true);
    setPdfMessage(null);
    setError(null);
    try {
      const filename = await downloadMonthlyPdfReport(month, year, currency);
      setPdfMessage(`Downloaded ${filename}`);
      setTimeout(() => setPdfMessage(null), 4000);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to generate PDF report.'));
    } finally {
      setPdfDownloading(false);
    }
  };

  const handleQuickAddSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setQuickNotice(null);
    if (quickListening) stopQuickVoice();

    const trimmed = quickText.trim();
    if (!trimmed) {
      setTxInitialTranscript('');
      setTxModalOpen(true);
      return;
    }

    let numericAmount = roundTwo(Number(parsedQuick.amount));
    let txType = parsedQuick.type || 'EXPENSE';
    let txTitle = (parsedQuick.title || trimmed).slice(0, 100);
    let txDate = parsedQuick.date || toInputDateValue();
    let txAccount = resolvedQuickAccount;
    let txToAccount = resolvedQuickToAccount;
    let txCategory = resolvedQuickCategory;
    let txNotes = parsedQuick.notes || null;

    if (
      (!Number.isFinite(numericAmount) || numericAmount <= 0) &&
      aiConfigured
    ) {
      setAiParsing(true);
      try {
        const aiRes = await api.post<{ parsed: ParsedVoiceTransaction }>(
          '/ai/parse-transaction',
          { text: trimmed }
        );
        const aiParsed = aiRes.data.parsed;
        const aiAmount = roundTwo(Number(aiParsed.amount));
        if (Number.isFinite(aiAmount) && aiAmount > 0) {
          numericAmount = aiAmount;
          txType = aiParsed.type || txType;
          txTitle = (aiParsed.title || txTitle).slice(0, 100);
          txDate = aiParsed.date || txDate;
          txAccount =
            accounts.find((a) => String(a.id) === aiParsed.accountId) || txAccount;
          txToAccount =
            accounts.find((a) => String(a.id) === aiParsed.toAccountId) || txToAccount;
          txCategory =
            categories.find((c) => String(c.id) === aiParsed.categoryId) || txCategory;
          txNotes = aiParsed.notes || txNotes;
        }
      } catch {
        // Fallback smoothly to modal if AI parsing cannot resolve
      } finally {
        setAiParsing(false);
      }
    }

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      !txAccount ||
      (txType === 'TRANSFER' && !txToAccount) ||
      (txType !== 'TRANSFER' && !txCategory)
    ) {
      setTxInitialParsed(null);
      setTxInitialTranscript(trimmed);
      setTxModalOpen(true);
      return;
    }

    setQuickSubmitting(true);
    try {
      await api.post('/transactions', {
        title: txTitle,
        amount: numericAmount,
        type: txType,
        date: txDate,
        accountId: txAccount.id,
        toAccountId:
          txType === 'TRANSFER' && txToAccount
            ? txToAccount.id
            : null,
        categoryId:
          txType !== 'TRANSFER' && txCategory
            ? txCategory.id
            : null,
        notes: txNotes,
        isRecurring: false,
        recurringInterval: null,
      });

      setQuickText('');
      resetQuickVoice();
      setQuickNotice(
        `Logged ${txType.toLowerCase()}: ${txTitle} (${formatCurrency(numericAmount, currency)})`
      );
      setTimeout(() => setQuickNotice(null), 4500);
      await loadDashboard();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to save quick-add transaction.'));
    } finally {
      setQuickSubmitting(false);
    }
  };

  const kpis = analytics?.kpis ?? {
    totalNetWorth: 0,
    monthlyIncome: 0,
    monthlyExpense: 0,
    savingsRate: 0,
    incomeDeltaPct: null,
    expenseDeltaPct: null,
    netCashflow: 0,
    prevNetCashflow: 0,
  };

  const clampedSavingsPct = Math.max(0, Math.min(100, roundTwo(kpis.savingsRate)));

  const incomeGoalProgress = useMemo(() => {
    const goal = user?.monthlyIncomeGoal ?? 0;
    if (goal <= 0) return 0;
    return Math.min(100, Math.round((kpis.monthlyIncome / goal) * 1000) / 10);
  }, [kpis.monthlyIncome, user?.monthlyIncomeGoal]);

  const cashflowChartData = useMemo(
    () =>
      (analytics?.monthlyTrend ?? []).map((item) => ({
        Month: item.label,
        Income: item.income,
        Expense: item.expense,
      })),
    [analytics?.monthlyTrend]
  );

  const dailySeriesKey =
    curveMode === 'cumulative' ? 'Cumulative Spend' : 'Daily Spend';

  const dailyChartData = useMemo(
    () =>
      (analytics?.dailySpendingCurve ?? []).map((pt) => ({
        Day: `Day ${pt.day}`,
        [dailySeriesKey]: curveMode === 'cumulative' ? pt.cumulative : pt.expense,
      })),
    [analytics?.dailySpendingCurve, curveMode, dailySeriesKey]
  );

  const categoryDonutData = useMemo(
    () =>
      (analytics?.categoryBreakdown ?? []).map((item) => ({
        name: item.name,
        value: item.total,
        percentage: item.percentage,
      })),
    [analytics?.categoryBreakdown]
  );

  const categoryBarListData = useMemo(
    () =>
      (analytics?.categoryBreakdown ?? []).map((item, idx) => ({
        key: String(item.categoryId),
        name: `${item.name} (${item.percentage}%)`,
        value: item.total,
        color: TREMOR_CATEGORY_COLORS[idx % TREMOR_CATEGORY_COLORS.length],
      })),
    [analytics?.categoryBreakdown]
  );

  const walletBarListData = useMemo(
    () =>
      accounts.slice(0, 3).map((acc, idx) => ({
        key: String(acc.id),
        name: acc.name,
        value: acc.balance,
        color: (['blue', 'emerald', 'indigo'] as Color[])[idx % 3],
      })),
    [accounts]
  );

  const netCashflowDeltaPct = useMemo(() => {
    if (kpis.prevNetCashflow === 0) return null;
    return (
      Math.round(
        ((kpis.netCashflow - kpis.prevNetCashflow) /
          Math.abs(kpis.prevNetCashflow)) *
          1000
      ) / 10
    );
  }, [kpis.netCashflow, kpis.prevNetCashflow]);

  const activeAlerts = useMemo(
    () =>
      alerts.filter((a) => {
        if (a.kind === 'OVERDRAFT') return features.overdraftWarning;
        if (a.kind === 'BUDGET') return features.budgetAlerts;
        if (a.kind === 'GOAL') return features.savingsGoals;
        return true;
      }),
    [alerts, features.budgetAlerts, features.overdraftWarning, features.savingsGoals]
  );

  const recentByDay = useMemo(() => {
    const groups = new Map<
      string,
      {
        dayKey: string;
        heading: string;
        spentCents: number;
        items: NonNullable<AnalyticsResponse['recentTransactions']>;
      }
    >();
    for (const tx of analytics?.recentTransactions ?? []) {
      const dayKey = tx.date.slice(0, 10);
      let grp = groups.get(dayKey);
      if (!grp) {
        grp = {
          dayKey,
          heading: formatDayHeading(tx.date),
          spentCents: 0,
          items: [],
        };
        groups.set(dayKey, grp);
      }
      if (tx.type === 'EXPENSE') {
        grp.spentCents += Math.round(tx.amount * 100);
      }
      grp.items.push(tx);
    }
    return Array.from(groups.values());
  }, [analytics?.recentTransactions]);

  const cardSurfaceClass =
    'bg-white dark:bg-[#111114] ring-1 ring-slate-200 dark:ring-white/[0.08] rounded-2xl shadow-sm';

  return (
    <Layout
      title={t('dashboard.title')}
      subtitle={t('dashboard.subtitle')}
      headerAction={
        <div className="flex items-center gap-2">
          {features.pdfReports && (
            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={pdfDownloading}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.1] rounded-xl hover:border-blue-500/60 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <FileDown className="w-3.5 h-3.5 text-blue-500" />
              <span>{pdfDownloading ? 'Generating...' : 'PDF Report'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setTxInitialTranscript('');
              setTxModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-600/25 transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('dashboard.addEntry')}</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      }
    >
      <motion.div
        variants={bentoContainerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-5"
      >
        {/* Top Period Toolbar */}
        <motion.div
          variants={bentoItemVariants}
          className="flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-center gap-2.5">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              aria-label="Select month"
              className="px-3.5 py-2 text-sm font-medium text-slate-900 dark:text-white bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              aria-label="Select year"
              className="px-3.5 py-2 text-sm font-mono font-medium text-slate-900 dark:text-white bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={pdfDownloading}
              className="sm:hidden inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-xl cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-blue-500" />
              <span>{pdfDownloading ? 'PDF...' : 'PDF'}</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-zinc-400">
            {pdfMessage && (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {pdfMessage}
              </span>
            )}
            <Link
              to="/wallets"
              className="hover:text-blue-500 transition-colors font-medium"
            >
              {accounts.length} active wallet{accounts.length === 1 ? '' : 's'}
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              to="/budgets"
              className="hover:text-blue-500 transition-colors font-medium"
            >
              {analytics?.budgetAlerts.length ?? 0} tracked budgets
            </Link>
          </div>
        </motion.div>

        {/* Prominent Top Alerts Banner (Overdrawn Wallets, Budget Thresholds, Goal Deadlines) */}
        {activeAlerts.length > 0 && (
          <motion.div
            variants={bentoItemVariants}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            {activeAlerts.slice(0, 4).map((alert) => {
              const isCritical = alert.severity === 'CRITICAL';
              return (
                <Link
                  key={alert.id}
                  to={alert.link}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-colors ${
                    isCritical
                      ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/70 text-rose-900 dark:text-rose-200 hover:border-rose-400'
                      : 'bg-amber-50 dark:bg-amber-950/25 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 hover:border-amber-400'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold">{alert.title}</p>
                    <p className="text-[11px] opacity-90 mt-0.5">{alert.message}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-1 opacity-70" />
                </Link>
              );
            })}
          </motion.div>
        )}

        {/* Quick-Add Voice & Natural-Language Bar */}
        {features.voiceQuickAdd && (
          <motion.div variants={bentoItemVariants}>
            <Card className={`${cardSurfaceClass} p-4 sm:p-5`}>
            <form onSubmit={handleQuickAddSubmit} className="space-y-2.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="relative flex-1 flex items-center">
                  <button
                    type="button"
                    onClick={() =>
                      quickListening ? stopQuickVoice() : void startQuickVoice()
                    }
                    disabled={!voiceSupported}
                    aria-label={
                      quickListening
                        ? 'Stop microphone voice input'
                        : 'Start microphone voice input'
                    }
                    title={
                      voiceSupported
                        ? quickListening
                          ? 'Stop listening'
                          : 'Log transaction by voice'
                        : 'Web Speech API not supported in this browser'
                    }
                    className={`absolute left-2 z-10 inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      quickListening
                        ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-sm shadow-rose-600/30'
                        : 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/25'
                    }`}
                  >
                    {quickListening ? (
                      <Square className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </button>

                  <input
                    type="text"
                    value={quickText}
                    onChange={(e) => setQuickText(e.target.value)}
                    placeholder={
                      quickListening
                        ? 'Listening... speak e.g. "Spent 1250 on coffee from cash"'
                        : 'Quick-add or tap mic: "Spent 1,250 on coffee from cash wallet"'
                    }
                    aria-label="Quick add transaction text or voice transcript"
                    className="w-full pl-12 pr-4 py-2.5 text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-[#09090B] border border-slate-200 dark:border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {aiConfigured && quickText.trim() && (
                    <button
                      type="button"
                      disabled={aiParsing || quickSubmitting}
                      onClick={async () => {
                        if (quickListening) stopQuickVoice();
                        setError(null);
                        setAiParsing(true);
                        try {
                          const res = await api.post<{ parsed: ParsedVoiceTransaction }>(
                            '/ai/parse-transaction',
                            { text: quickText.trim() }
                          );
                          setTxInitialParsed(res.data.parsed);
                          setTxInitialTranscript('');
                          setTxModalOpen(true);
                        } catch (err) {
                          setError(getApiErrorMessage(err, 'Groq AI parse failed.'));
                        } finally {
                          setAiParsing(false);
                        }
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-500/25 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{aiParsing ? 'Parsing...' : 'AI Parse'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (quickListening) stopQuickVoice();
                      setTxInitialParsed(null);
                      setTxInitialTranscript(quickText.trim());
                      setTxModalOpen(true);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] rounded-xl hover:bg-slate-200 dark:hover:bg-white/[0.09] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Details</span>
                  </button>

                  <button
                    type="submit"
                    disabled={quickSubmitting || aiParsing}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-600/20 disabled:opacity-50 transition-all whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{quickSubmitting ? 'Logging...' : 'Quick Log'}</span>
                  </button>
                </div>
              </div>

              {/* Status & live parsed preview */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1">
                {quickVoiceError ? (
                  <span role="alert" className="text-rose-600 dark:text-rose-400 font-medium">
                    {quickVoiceError}
                  </span>
                ) : quickNotice ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    <Check className="w-3.5 h-3.5" />
                    <span>{quickNotice}</span>
                  </span>
                ) : quickText.trim() ? (
                  <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-zinc-400 font-mono tabular-nums">
                    <span className="font-sans font-semibold text-slate-800 dark:text-zinc-200">
                      {parsedQuick.type === 'INCOME'
                        ? 'Income'
                        : parsedQuick.type === 'TRANSFER'
                          ? 'Transfer'
                          : 'Expense'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {parsedQuick.amount
                        ? formatCurrency(Number(parsedQuick.amount), currency)
                        : 'Amount needed'}
                    </span>
                    {parsedQuick.title && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-sans">{parsedQuick.title}</span>
                      </>
                    )}
                    {parsedQuick.type !== 'TRANSFER' && resolvedQuickCategory && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-sans">{resolvedQuickCategory.name}</span>
                      </>
                    )}
                    {resolvedQuickAccount && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-sans">
                          {parsedQuick.type === 'TRANSFER' && resolvedQuickToAccount
                            ? `${resolvedQuickAccount.name} → ${resolvedQuickToAccount.name}`
                            : `${resolvedQuickAccount.name} (${formatCurrency(resolvedQuickAccount.balance, currency)})`}
                        </span>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500 dark:text-zinc-500">
                    {quickListening
                      ? 'Microphone active — speak your transaction naturally, then tap stop or Quick Log.'
                      : 'Voice quick-add supports phrases like "Received 85k salary into bank" or "Transfer 5000 from bank to cash".'}
                  </p>
                )}
              </div>
            </form>
          </Card>
        </motion.div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-center justify-between gap-4 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="text-xs font-semibold underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Asymmetric Tremor Bento KPI Row (5 + 7) */}
        <motion.div
          variants={bentoItemVariants}
          className="grid grid-cols-1 xl:grid-cols-12 gap-5"
        >
          {/* Hero Net Worth Tremor Card */}
          <Card className={`xl:col-span-5 ${cardSurfaceClass} p-6 flex flex-col justify-between gap-5`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                  {t('dashboard.netWorth')}
                </p>
                {loading && !analytics ? (
                  <div className="mt-2 h-9 w-44 rounded-lg skeleton-shimmer" />
                ) : (
                  <Metric className="mt-1.5 text-2xl sm:text-3xl font-bold font-mono tabular-nums tracking-tight text-slate-900 dark:text-white">
                    {formatCurrency(kpis.totalNetWorth, currency)}
                  </Metric>
                )}
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-500/25">
                  <Wallet className="w-4 h-4" aria-hidden="true" />
                </div>
                {netCashflowDeltaPct !== null && (
                  <BadgeDelta
                    deltaType={resolveDeltaType(netCashflowDeltaPct)}
                    isIncreasePositive={true}
                    size="xs"
                  >
                    {netCashflowDeltaPct >= 0 ? '+' : ''}
                    {netCashflowDeltaPct}% net
                  </BadgeDelta>
                )}
              </div>
            </div>

            {walletBarListData.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                  <span>Top Connected Wallets</span>
                  <button
                    type="button"
                    onClick={() => void handleDownloadPdf()}
                    disabled={pdfDownloading}
                    className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>{pdfDownloading ? 'Exporting PDF...' : 'Download Monthly PDF'}</span>
                  </button>
                </div>
                <BarList
                  data={walletBarListData}
                  valueFormatter={(v: number) => formatCurrency(v, currency)}
                  showAnimation={true}
                />
              </div>
            )}
          </Card>

          {/* Right Cluster: Income, Expense, Savings Rate Tremor Cards */}
          <div className="xl:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Monthly Income */}
            <Card className={`${cardSurfaceClass} p-5 flex flex-col justify-between gap-4`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                  {t('dashboard.monthlyIncome')}
                </span>
                <ArrowUpRight className="w-4 h-4 text-emerald-500 shrink-0" />
              </div>

              <div className="space-y-2">
                {loading && !analytics ? (
                  <div className="h-7 w-28 rounded skeleton-shimmer" />
                ) : (
                  <Metric className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(kpis.monthlyIncome, currency, true)}
                  </Metric>
                )}
                <BadgeDelta
                  deltaType={resolveDeltaType(kpis.incomeDeltaPct)}
                  isIncreasePositive={true}
                  size="xs"
                >
                  {kpis.incomeDeltaPct !== null
                    ? `${kpis.incomeDeltaPct >= 0 ? '+' : ''}${kpis.incomeDeltaPct}% vs prev`
                    : 'Current period'}
                </BadgeDelta>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-zinc-400">
                  <span>Goal Progress</span>
                  <span>
                    {user?.monthlyIncomeGoal && user.monthlyIncomeGoal > 0
                      ? `${incomeGoalProgress}%`
                      : 'No goal set'}
                  </span>
                </div>
                <ProgressBar
                  value={incomeGoalProgress}
                  color="emerald"
                  showAnimation={true}
                />
              </div>
            </Card>

            {/* Monthly Expense */}
            <Card className={`${cardSurfaceClass} p-5 flex flex-col justify-between gap-4`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                  {t('dashboard.monthlyExpense')}
                </span>
                <ArrowDownRight className="w-4 h-4 text-rose-500 shrink-0" />
              </div>

              <div className="space-y-2">
                {loading && !analytics ? (
                  <div className="h-7 w-28 rounded skeleton-shimmer" />
                ) : (
                  <Metric className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                    {formatCurrency(kpis.monthlyExpense, currency)}
                  </Metric>
                )}
                <BadgeDelta
                  deltaType={resolveDeltaType(kpis.expenseDeltaPct)}
                  isIncreasePositive={false}
                  size="xs"
                >
                  {kpis.expenseDeltaPct !== null
                    ? `${kpis.expenseDeltaPct >= 0 ? '+' : ''}${kpis.expenseDeltaPct}% vs prev`
                    : 'Current period'}
                </BadgeDelta>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-zinc-400">
                  <span>Outflow / Income</span>
                  <span>
                    {kpis.monthlyIncome > 0
                      ? `${Math.min(
                          999,
                          Math.round((kpis.monthlyExpense / kpis.monthlyIncome) * 1000) /
                            10
                        )}%`
                      : '0%'}
                  </span>
                </div>
                <ProgressBar
                  value={
                    kpis.monthlyIncome > 0
                      ? Math.min(100, (kpis.monthlyExpense / kpis.monthlyIncome) * 100)
                      : kpis.monthlyExpense > 0
                        ? 100
                        : 0
                  }
                  color={
                    kpis.monthlyIncome > 0 && kpis.monthlyExpense > kpis.monthlyIncome
                      ? 'rose'
                      : 'amber'
                  }
                  showAnimation={true}
                />
              </div>
            </Card>

            {/* Savings Rate */}
            <Card className={`${cardSurfaceClass} p-5 flex flex-col justify-between gap-4`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                  {t('dashboard.savingsRate')}
                </span>
                <TrendingUp className="w-4 h-4 text-cyan-500 shrink-0" />
              </div>

              <div className="space-y-2">
                {loading && !analytics ? (
                  <div className="h-7 w-24 rounded skeleton-shimmer" />
                ) : (
                  <Metric className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
                    {roundTwo(kpis.savingsRate)}%
                  </Metric>
                )}
                <BadgeDelta
                  deltaType={
                    kpis.savingsRate >= 20
                      ? 'increase'
                      : kpis.savingsRate > 0
                        ? 'moderateIncrease'
                        : kpis.savingsRate < 0
                          ? 'decrease'
                          : 'unchanged'
                  }
                  isIncreasePositive={true}
                  size="xs"
                >
                  Net {formatCompactCurrency(kpis.netCashflow, currency)}
                </BadgeDelta>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                  <span>Target: 20%+</span>
                  <span className="font-mono tabular-nums">
                    {formatCompactCurrency(kpis.netCashflow, currency)}
                  </span>
                </div>
                <ProgressBar
                  value={clampedSavingsPct}
                  color={
                    kpis.savingsRate >= 20
                      ? 'emerald'
                      : kpis.savingsRate > 0
                        ? 'cyan'
                        : 'rose'
                  }
                  showAnimation={true}
                />
              </div>
            </Card>
          </div>
        </motion.div>

        {/* Row 2: 6-Month Cashflow AreaChart (7 cols) + Category DonutChart & BarList (5 cols) */}
        <motion.div
          variants={bentoItemVariants}
          className="grid grid-cols-1 lg:grid-cols-12 gap-5"
        >
          <Card className={`lg:col-span-7 ${cardSurfaceClass} p-6`}>
            <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  6-Month Cashflow Velocity
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Monthly income versus outflows
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-zinc-400">
                Net: {formatCurrency(kpis.netCashflow, currency)}
              </span>
            </div>

            {loading && !analytics ? (
              <div className="h-[290px] w-full rounded-xl skeleton-shimmer" />
            ) : (
              <AreaChart
                className="h-[290px] w-full"
                data={cashflowChartData}
                index="Month"
                categories={['Income', 'Expense']}
                colors={['emerald', 'rose']}
                valueFormatter={(v: number) => formatCompactCurrency(v, currency)}
                yAxisWidth={68}
                showAnimation={true}
                showGradient={true}
                curveType="monotone"
              />
            )}
          </Card>

          <Card className={`lg:col-span-5 ${cardSurfaceClass} p-6 flex flex-col justify-between`}>
            <div className="flex items-baseline justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Category Distribution
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Share of monthly spending
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-zinc-400">
                {analytics?.categoryBreakdown.length ?? 0} categories
              </span>
            </div>

            {loading && !analytics ? (
              <div className="h-[260px] flex items-center justify-center">
                <div className="w-36 h-36 rounded-full skeleton-shimmer" />
              </div>
            ) : categoryDonutData.length === 0 ? (
              <div className="flex-1 min-h-[240px] flex flex-col items-center justify-center text-center px-4">
                <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                  No expenses logged for this period
                </p>
                <button
                  type="button"
                  onClick={() => setTxModalOpen(true)}
                  className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/15 rounded-xl cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log First Expense</span>
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between gap-4">
                <DonutChart
                  className="h-44"
                  data={categoryDonutData}
                  category="value"
                  index="name"
                  variant="donut"
                  colors={TREMOR_CATEGORY_COLORS}
                  label={formatCompactCurrency(kpis.monthlyExpense, currency)}
                  showLabel={true}
                  valueFormatter={(v: number) => formatCurrency(v, currency)}
                  showAnimation={true}
                />

                <div className="border-t border-slate-100 dark:border-white/[0.06] pt-3 max-h-[155px] overflow-y-auto pr-1">
                  <BarList
                    data={categoryBarListData}
                    valueFormatter={(v: number) => formatCurrency(v, currency)}
                    showAnimation={true}
                  />
                </div>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Row 3: Daily Spending AreaChart (7 cols) + Budgets & Goals Tremor ProgressBars (5 cols) */}
        <motion.div
          variants={bentoItemVariants}
          className="grid grid-cols-1 lg:grid-cols-12 gap-5"
        >
          <Card className={`lg:col-span-7 ${cardSurfaceClass} p-6`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Daily Spending Trajectory
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Outflow velocity across calendar days
                </p>
              </div>

              <div className="inline-flex p-1 bg-slate-100 dark:bg-white/[0.05] rounded-xl border border-slate-200 dark:border-white/[0.06]">
                {(['cumulative', 'daily'] as const).map((mode) => {
                  const active = curveMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setCurveMode(mode)}
                      className={`relative px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        active
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-500 dark:text-zinc-400'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="daily-curve-tab"
                          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                          className="absolute inset-0 rounded-lg bg-white dark:bg-[#1C1C22] shadow-xs"
                        />
                      )}
                      <span className="relative z-10">
                        {mode === 'cumulative' ? 'Cumulative' : 'Daily Spend'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {loading && !analytics ? (
              <div className="h-[245px] w-full rounded-xl skeleton-shimmer" />
            ) : (
              <AreaChart
                className="h-[245px] w-full"
                data={dailyChartData}
                index="Day"
                categories={[dailySeriesKey]}
                colors={[curveMode === 'cumulative' ? 'indigo' : 'cyan']}
                valueFormatter={(v: number) => formatCompactCurrency(v, currency)}
                yAxisWidth={68}
                showAnimation={true}
                showGradient={true}
                showLegend={false}
                curveType="monotone"
              />
            )}
          </Card>

          {/* Budgets & Savings Goals Switchable Bento Panel */}
          <Card className={`lg:col-span-5 ${cardSurfaceClass} p-6 flex flex-col justify-between gap-4`}>
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex p-1 bg-slate-100 dark:bg-white/[0.05] rounded-xl border border-slate-200 dark:border-white/[0.06]">
                {(['budgets', 'goals'] as const).map((tab) => {
                  const active = planTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setPlanTab(tab)}
                      className={`relative px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        active
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-500 dark:text-zinc-400'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="plan-tab-pill"
                          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                          className="absolute inset-0 rounded-lg bg-white dark:bg-[#1C1C22] shadow-xs"
                        />
                      )}
                      <span className="relative z-10">
                        {tab === 'budgets' ? 'Budget Alerts' : 'Savings Goals'}
                      </span>
                    </button>
                  );
                })}
              </div>

              <Link
                to={planTab === 'budgets' ? '/budgets' : '/goals'}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                <span>Manage</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {planTab === 'budgets' ? (
              (analytics?.budgetAlerts.length ?? 0) === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                  <AlertTriangle className="w-6 h-6 text-slate-400 mb-2" />
                  <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                    No monthly budgets configured yet
                  </p>
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto max-h-[245px] pr-1">
                  {analytics?.budgetAlerts.slice(0, 4).map((b) => {
                    const isExceeded = b.status === 'EXCEEDED';
                    const isWarn = b.status === 'WARNING';
                    const barColor: Color = isExceeded
                      ? 'rose'
                      : isWarn
                        ? 'amber'
                        : 'emerald';
                    return (
                      <div
                        key={b.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-slate-900 dark:text-white truncate">
                            {b.categoryName}
                          </span>
                          <BadgeDelta
                            deltaType={
                              isExceeded
                                ? 'increase'
                                : isWarn
                                  ? 'moderateIncrease'
                                  : 'decrease'
                            }
                            isIncreasePositive={false}
                            size="xs"
                          >
                            {b.percentage}%
                          </BadgeDelta>
                        </div>

                        <ProgressBar
                          value={Math.min(100, b.percentage)}
                          color={barColor}
                          showAnimation={true}
                        />

                        <div className="flex justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-zinc-400">
                          <span>{formatCurrency(b.spent, currency)} spent</span>
                          <span>{formatCurrency(b.limit, currency)} limit</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (analytics?.goals.length ?? 0) === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <Target className="w-6 h-6 text-slate-400 mb-2" />
                <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                  No savings goals added yet
                </p>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[245px] pr-1">
                {analytics?.goals.map((g) => {
                  const pct =
                    g.targetAmount > 0
                      ? Math.min(
                          100,
                          Math.round((g.currentAmount / g.targetAmount) * 1000) / 10
                        )
                      : 0;
                  return (
                    <div
                      key={g.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-900 dark:text-white truncate">
                          {g.title}
                        </span>
                        <span className="font-mono font-semibold tabular-nums text-emerald-500">
                          {pct}%
                        </span>
                      </div>

                      <ProgressBar
                        value={pct}
                        color="emerald"
                        showAnimation={true}
                      />

                      <div className="flex justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-zinc-400">
                        <span>{formatCurrency(g.currentAmount, currency)} saved</span>
                        <span>{formatCurrency(g.targetAmount, currency)} goal</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Row 4: Full-Width Day-by-Day Recent Activity Bento Card */}
        <motion.div variants={bentoItemVariants}>
          <Card className={`${cardSurfaceClass} p-6`}>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('dashboard.recentActivity')}
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Entries grouped by date so you can see exactly which day each expense was logged
                </p>
              </div>
              <Link
                to="/transactions"
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                <span>{t('dashboard.openLedger')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading && !analytics ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-12 w-full rounded-xl skeleton-shimmer" />
                ))}
              </div>
            ) : recentByDay.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500 dark:text-zinc-400">
                No transactions recorded yet. Click Add Entry to log your first transaction.
              </div>
            ) : (
              <div className="space-y-4">
                {recentByDay.map((group) => (
                  <div
                    key={group.dayKey}
                    className="rounded-xl border border-slate-200 dark:border-white/[0.06] overflow-hidden"
                  >
                    <div className="px-4 py-2 bg-slate-50 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 dark:text-zinc-200">
                        <CalendarDays className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{group.heading}</span>
                      </span>
                      {group.spentCents > 0 && (
                        <span className="font-mono tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                          Day Spent: -{formatCurrency(group.spentCents / 100, currency)}
                        </span>
                      )}
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-white/[0.05] px-4">
                      {group.items.map((tx) => {
                        const isIncome = tx.type === 'INCOME';
                        const isTransfer = tx.type === 'TRANSFER';
                        return (
                          <div
                            key={tx.id}
                            className="py-3 flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-slate-200 dark:border-white/[0.08]"
                                style={{
                                  backgroundColor: tx.category
                                    ? `${tx.category.color}18`
                                    : 'rgba(37,99,235,0.12)',
                                  color: tx.category?.color || '#2563EB',
                                }}
                              >
                                <CategoryIcon
                                  name={tx.category?.icon || 'Tag'}
                                  className="w-4 h-4"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                  {tx.title}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                                  {isTransfer
                                    ? `${tx.account.name} → ${tx.toAccount?.name || ''}`
                                    : `${tx.category?.name || 'Uncategorized'} · ${tx.account.name}`}{' '}
                                  · {formatDisplayDate(tx.date)} {formatLoggedTime(tx.createdAt)}
                                </p>
                              </div>
                            </div>

                            <span
                              className={`text-sm font-mono font-semibold tabular-nums shrink-0 ${
                                isIncome
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : isTransfer
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-slate-900 dark:text-zinc-100'
                              }`}
                            >
                              {isIncome ? '+' : isTransfer ? '' : '-'}
                              {formatCurrency(tx.amount, currency)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </motion.div>

      <TransactionModal
        isOpen={txModalOpen}
        onClose={() => {
          setTxModalOpen(false);
          setTxInitialTranscript('');
          setTxInitialParsed(null);
        }}
        onSaved={() => void loadDashboard()}
        accounts={accounts}
        categories={categories}
        initialVoiceTranscript={txInitialTranscript}
        initialParsed={txInitialParsed}
      />
    </Layout>
  );
}
