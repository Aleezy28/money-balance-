import {
  ArrowRight,
  Bell,
  BookOpen,
  FileDown,
  Keyboard,
  Layers,
  Mic,
  PiggyBank,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { usePreferences } from '../context/PreferencesContext';

type GuideSection = 'all' | 'wallets' | 'accounting' | 'preferences';

interface ManualTopic {
  id: string;
  section: Exclude<GuideSection, 'all'>;
  number: string;
  title: string;
  summary: string;
  icon: LucideIcon;
  steps: string[];
  actionLabel: string;
  actionTo: string;
}

const TOPICS: ManualTopic[] = [
  {
    id: 'wallets-overdraft',
    section: 'wallets',
    number: '01',
    title: 'Cash, Bank & Overdraft Protection',
    summary:
      'Keep Cash, Bank Accounts, Cards, and Mobile Wallets separated so an expense never accidentally deducts from an empty wallet.',
    icon: Wallet,
    steps: [
      'When adding a new expense, Multi-Wallet automatically selects your highest positive-balance wallet (such as Cash) instead of an empty Bank Account.',
      'Check the live Before → After balance preview inside the Add Entry drawer before saving.',
      'If a selected wallet will drop below zero, an Overdraft Warning appears with a one-click button to switch to a funded wallet.',
      'Use Transfer Funds inside Cash / Bank to move money between wallets (for example Cash to Bank) without inflating your monthly expense totals.',
      'Whenever any wallet is negative, Cash / Bank shows the exact Positive Wallets − Overdrawn = Combined Net Worth breakdown.',
    ],
    actionLabel: 'Open Cash / Bank',
    actionTo: '/wallets',
  },
  {
    id: 'daily-expenses',
    section: 'wallets',
    number: '02',
    title: 'Day-by-Day Expenses & Logged Timestamps',
    summary:
      'See exactly which calendar day each expense was added, daily spent subtotals, and logged timestamps.',
    icon: Layers,
    steps: [
      'Expenses & Entries defaults to the By Day timeline view, grouping entries under clear weekday and date headings with daily inflow and spent subtotals.',
      'Switch anytime between By Day and Table view using the view toggle at the top of Expenses & Entries.',
      'Every transaction displays its exact logged date and time alongside category, wallet, and recurring status.',
      'Use Import CSV or Export CSV on the Expenses & Entries toolbar to back up or bulk-import transactions.',
    ],
    actionLabel: 'Open Expenses & Entries',
    actionTo: '/transactions',
  },
  {
    id: 'voice-quick-add',
    section: 'wallets',
    number: '03',
    title: 'Voice-to-Text Quick Add (Microphone)',
    summary:
      'Log expenses hands-free from the Dashboard quick-add bar using your browser microphone.',
    icon: Mic,
    steps: [
      'Click the Microphone button in the Dashboard Quick Add card and allow browser microphone access.',
      'Speak naturally, for example: "Spent 1500 on groceries from cash" or "Received 50000 salary in bank".',
      'Review the parsed title, amount, type, category, and selected wallet in the live preview before clicking Save.',
      'If you prefer not to see the microphone button, toggle Voice Quick-Add off in Settings.',
    ],
    actionLabel: 'Go to Dashboard',
    actionTo: '/dashboard',
  },
  {
    id: 'accounting-suite',
    section: 'accounting',
    number: '04',
    title: 'Chart of Accounts, Account Ledger & Statements',
    summary:
      'Double-entry accounting reports reconciled in exact integer cents across every wallet and category.',
    icon: Scale,
    steps: [
      'Chart of Accounts lists Asset wallets (10xx), Overdraft Liabilities (20xx), Income categories (40xx), and Expense categories (50xx).',
      'Account Ledger shows opening balance, chronological inflows/outflows, running balance after each entry, and closing balance for any selected wallet and date range.',
      'Balance Sheet verifies Total Assets = Total Liabilities + Total Equity down to the last decimal.',
      'Profit & Loss calculates total income, total expenses, net profit/surplus, and savings rate for the chosen month or all-time.',
      'Trial Balance lists all debit and credit balances and confirms Total Debits === Total Credits.',
    ],
    actionLabel: 'Open Account Ledger',
    actionTo: '/accounts/ledger',
  },
  {
    id: 'budgets-alerts',
    section: 'accounting',
    number: '05',
    title: 'Monthly Budgets, Goals & Header Alerts',
    summary:
      'Stay ahead of overspending with 80% warnings, 100% exceeded alerts, and savings goal deadline reminders.',
    icon: Bell,
    steps: [
      'Set monthly spending caps per expense category inside Monthly Budgets.',
      'Track milestone progress and contribute directly from any wallet inside Savings Goals.',
      'Check the top-right Alerts bell from any screen or the Dashboard top banner to review overdrawn wallets, 80%/100% budget alerts, and goals due within 14 days.',
      'Click any alert to jump straight to the affected wallet ledger, budget, or goal.',
    ],
    actionLabel: 'Open Monthly Budgets',
    actionTo: '/budgets',
  },
  {
    id: 'pdf-reports',
    section: 'accounting',
    number: '06',
    title: 'Monthly PDF Financial Statements',
    summary:
      'Generate clean A4 PDF monthly summaries of income, expenses, category breakdown, and savings progress.',
    icon: FileDown,
    steps: [
      'Click Download Monthly PDF on the Dashboard net worth card or use Quick Jump (Ctrl/Cmd + K → Download Monthly PDF Financial Report).',
      'The report summarizes monthly income, total expenses, net surplus, savings rate, category spending, and itemized transactions.',
    ],
    actionLabel: 'Open Profit & Loss',
    actionTo: '/accounts/profit-loss',
  },
  {
    id: 'language-features',
    section: 'preferences',
    number: '07',
    title: 'Languages, Feature Switches & Password Security',
    summary:
      'Personalize Multi-Wallet to match your preferred language, active modules, and account security.',
    icon: Settings,
    steps: [
      'Switch between English, Roman Urdu, Urdu (with automatic RTL layout), and Español from the header language menu or Settings.',
      'Under Customize App Features in Settings, turn optional modules (Accounting Suite, Voice Quick-Add, Budget Alerts, Savings Goals, PDF Reports, Overdraft Warning, Keyboard Shortcuts) ON or OFF anytime.',
      'Under Change Password in Settings, enter your current password and choose a new password (at least 6 characters).',
    ],
    actionLabel: 'Open Settings',
    actionTo: '/settings',
  },
  {
    id: 'shortcuts-guide',
    section: 'preferences',
    number: '08',
    title: 'Keyboard Shortcuts & Quick Jump',
    summary:
      'Navigate every wallet, ledger, statement, and modal rapidly using your keyboard.',
    icon: Keyboard,
    steps: [
      'Press Ctrl + K (or Cmd + K on Mac) anywhere to open Quick Jump and filter pages or download monthly PDFs.',
      'Press ? anytime outside text inputs to view all available shortcuts.',
      'Press G followed quickly by D (Dashboard), W (Cash / Bank), L (Account Ledger), E (Expenses & Entries), B (Budgets), C (Chart of Accounts), P (Profit & Loss), T (Trial Balance), M (User Manual), or S (Settings).',
    ],
    actionLabel: 'Open Trial Balance',
    actionTo: '/accounts/trial-balance',
  },
];

const SECTION_FILTERS: Array<{ id: GuideSection; label: string }> = [
  { id: 'all', label: 'All Guides' },
  { id: 'wallets', label: 'Wallets & Expenses' },
  { id: 'accounting', label: 'Accounting & Reports' },
  { id: 'preferences', label: 'Settings & Shortcuts' },
];

export default function UserManual() {
  const { t } = usePreferences();
  const [section, setSection] = useState<GuideSection>('all');
  const [search, setSearch] = useState('');

  const filteredTopics = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TOPICS.filter((topic) => {
      const matchesSection = section === 'all' || topic.section === section;
      if (!matchesSection) return false;
      if (!q) return true;
      return (
        topic.title.toLowerCase().includes(q) ||
        topic.summary.toLowerCase().includes(q) ||
        topic.steps.some((step) => step.toLowerCase().includes(q))
      );
    });
  }, [section, search]);

  return (
    <Layout
      title={t('manual.title')}
      subtitle={t('manual.subtitle')}
      headerAction={
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-sm shadow-indigo-600/20 transition-colors whitespace-nowrap"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Back to Overview</span>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Search & Section Filter Toolbar */}
        <section className="rounded-2xl bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search manual (e.g. overdraft, ledger, PDF, voice, password)..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-[#09090B] border border-slate-200 dark:border-white/[0.1] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div
            role="tablist"
            aria-label="Manual categories"
            className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-white/[0.04] rounded-xl border border-slate-200 dark:border-white/[0.06]"
          >
            {SECTION_FILTERS.map((tab) => {
              const active = section === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSection(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-[#18181B] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Quick Reference Highlights */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] p-5 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Exact Ledger Math</span>
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Integer-Cent Balance Precision
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Every transaction, transfer, and statement is reconciled in integer cents so Assets always equal Liabilities + Equity.
            </p>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] p-5 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <PiggyBank className="w-4 h-4" />
              <span>Zero-Confusion Deductions</span>
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Smart Funded-Wallet Default
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              New expenses automatically target your highest positive-balance wallet and warn before any account drops below zero.
            </p>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] p-5 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <Keyboard className="w-4 h-4" />
              <span>Fast Keyboard Workflow</span>
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Quick Jump &amp; G Chords
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Press Ctrl/Cmd + K to jump anywhere, or ? to open the complete keyboard shortcuts sheet.
            </p>
          </div>
        </section>

        {/* Manual Topics Grid */}
        {filteredTopics.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] p-12 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              No guide topics match "{search}"
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSection('all');
              }}
              className="px-4 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl cursor-pointer"
            >
              Show All Guide Topics
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredTopics.map((topic) => {
              const Icon = topic.icon;
              return (
                <article
                  key={topic.id}
                  className="rounded-2xl bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] p-6 flex flex-col justify-between gap-5"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-mono font-semibold text-slate-400 dark:text-zinc-500">
                            {topic.number}.
                          </p>
                          <h2 className="text-base font-bold text-slate-900 dark:text-white">
                            {topic.title}
                          </h2>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                      {topic.summary}
                    </p>

                    <ol className="space-y-2 border-t border-slate-100 dark:border-white/[0.06] pt-4">
                      {topic.steps.map((step, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-zinc-300 leading-relaxed"
                        >
                          <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5 tabular-nums">
                            {idx + 1}.
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex justify-end">
                    <Link
                      to={topic.actionTo}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
                    >
                      <span>{topic.actionLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
