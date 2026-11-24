import {
  BookCheck,
  CheckCircle2,
  FileText,
  Landmark,
  ListChecks,
  Scale,
  TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api, { getApiErrorMessage } from '../api/axios';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import type {
  Account,
  AccountLedgerResponse,
  AccountingStatementsResponse,
} from '../types';
import {
  formatCurrency,
  formatDisplayDate,
  formatLoggedTime,
  MONTH_OPTIONS,
} from '../utils/formatCurrency';

export type AccountingTab =
  | 'chart'
  | 'ledger'
  | 'balance-sheet'
  | 'profit-loss'
  | 'trial-balance';

interface AccountingProps {
  initialTab: AccountingTab;
}

const TAB_ROUTES: Record<AccountingTab, string> = {
  chart: '/accounts/chart',
  ledger: '/accounts/ledger',
  'balance-sheet': '/accounts/balance-sheet',
  'profit-loss': '/accounts/profit-loss',
  'trial-balance': '/accounts/trial-balance',
};

export default function Accounting({ initialTab }: AccountingProps) {
  const { currency } = useAuth();
  const { t } = usePreferences();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const now = useMemo(() => new Date(), []);
  const [tab, setTab] = useState<AccountingTab>(initialTab);
  const [scope, setScope] = useState<'month' | 'all'>('all');
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());

  const [statements, setStatements] = useState<AccountingStatementsResponse | null>(
    null
  );
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    searchParams.get('accountId') || ''
  );
  const [ledgerStart, setLedgerStart] = useState('');
  const [ledgerEnd, setLedgerEnd] = useState('');
  const [ledgerData, setLedgerData] = useState<AccountLedgerResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const paramId = searchParams.get('accountId');
    if (paramId) {
      setSelectedAccountId(paramId);
    }
  }, [searchParams]);

  const loadStatementsAndAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [stmtRes, accRes] = await Promise.all([
        api.get<AccountingStatementsResponse>('/analytics/statements', {
          params: { scope, month, year },
        }),
        api.get<{ accounts: Account[] }>('/accounts'),
      ]);
      setStatements(stmtRes.data);
      setAccounts(accRes.data.accounts);

      if (accRes.data.accounts[0]) {
        const preferred =
          accRes.data.accounts.find((a) => a.balance !== 0) ||
          accRes.data.accounts[0];
        setSelectedAccountId((prev) => prev || String(preferred.id));
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load accounting statements.'));
    } finally {
      setLoading(false);
    }
  }, [scope, month, year]);

  useEffect(() => {
    void loadStatementsAndAccounts();
  }, [loadStatementsAndAccounts]);

  const loadLedger = useCallback(async () => {
    if (!selectedAccountId) {
      setLedgerData(null);
      return;
    }
    setLedgerLoading(true);
    try {
      const params: Record<string, string> = {};
      if (ledgerStart) params.startDate = ledgerStart;
      if (ledgerEnd) params.endDate = ledgerEnd;
      const res = await api.get<AccountLedgerResponse>(
        `/accounts/${selectedAccountId}/ledger`,
        { params }
      );
      setLedgerData(res.data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load account ledger.'));
    } finally {
      setLedgerLoading(false);
    }
  }, [selectedAccountId, ledgerStart, ledgerEnd]);

  useEffect(() => {
    if (tab === 'ledger' && selectedAccountId) {
      void loadLedger();
    }
  }, [tab, selectedAccountId, loadLedger]);

  const yearOptions = useMemo(() => {
    const base = now.getFullYear();
    return [base - 2, base - 1, base, base + 1];
  }, [now]);

  const handleTabSwitch = (nextTab: AccountingTab) => {
    setTab(nextTab);
    navigate(TAB_ROUTES[nextTab]);
  };

  const tabItems: Array<{
    id: AccountingTab;
    label: string;
    icon: typeof BookCheck;
  }> = [
    { id: 'chart', label: t('nav.chartOfAccounts'), icon: BookCheck },
    { id: 'ledger', label: t('nav.accountLedger'), icon: FileText },
    { id: 'balance-sheet', label: t('nav.balanceSheet'), icon: Scale },
    { id: 'profit-loss', label: t('nav.profitLoss'), icon: TrendingUp },
    { id: 'trial-balance', label: t('nav.trialBalance'), icon: ListChecks },
  ];

  const pageTitles: Record<AccountingTab, string> = {
    chart: t('nav.chartOfAccounts'),
    ledger: t('nav.accountLedger'),
    'balance-sheet': t('nav.balanceSheet'),
    'profit-loss': t('nav.profitLoss'),
    'trial-balance': t('nav.trialBalance'),
  };

  return (
    <Layout
      title={pageTitles[tab]}
      subtitle="Double-entry statements, running wallet ledgers, and live account balances"
      headerAction={
        <Link
          to="/wallets"
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.1] rounded-xl hover:border-indigo-500 transition-colors whitespace-nowrap"
        >
          <Landmark className="w-3.5 h-3.5 text-indigo-500" />
          <span>{t('nav.cashBank')}</span>
        </Link>
      }
    >
      <div className="space-y-5">
        {error && (
          <div
            role="alert"
            className="px-4 py-3 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl"
          >
            {error}
          </div>
        )}

        {/* Navigation Sub-tabs + Period Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-3">
          <div className="flex flex-wrap items-center gap-1">
            {tabItems.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabSwitch(item.id)}
                  className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
                      : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {tab !== 'ledger' && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex p-1 bg-slate-100 dark:bg-white/[0.05] rounded-xl">
                {(['all', 'month'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScope(s)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
                      scope === s
                        ? 'bg-white dark:bg-[#1C1C22] text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-500 dark:text-zinc-400'
                    }`}
                  >
                    {s === 'all' ? 'All Time' : 'By Month'}
                  </button>
                ))}
              </div>

              {scope === 'month' && (
                <>
                  <select
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    aria-label="Statement month"
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-[#09090B] border border-slate-200 dark:border-white/[0.1] rounded-xl"
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
                    aria-label="Statement year"
                    className="px-2.5 py-1.5 text-xs font-mono font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-[#09090B] border border-slate-200 dark:border-white/[0.1] rounded-xl"
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          )}
        </div>

        {/* TAB 1: CHART OF ACCOUNTS */}
        {tab === 'chart' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Asset & Liability Wallets */}
            <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Cash, Bank &amp; Wallet Accounts
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Each wallet maintains an independent ledger balance
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-500">1000–2999</span>
              </div>

              {loading && !statements ? (
                <div className="h-36 rounded-xl skeleton-shimmer" />
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {[
                    ...(statements?.chartOfAccounts.assets ?? []).map((a) => ({
                      ...a,
                      signedBalance: a.balance,
                      kindLabel: 'Asset',
                    })),
                    ...(statements?.chartOfAccounts.liabilities ?? []).map((a) => ({
                      ...a,
                      signedBalance: -a.balance,
                      kindLabel: 'Overdrawn',
                    })),
                  ].map((acc) => (
                    <div
                      key={acc.id}
                      className="py-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-xs text-slate-400">
                          {acc.code}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {acc.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-zinc-400">
                            {acc.type} · {acc.kindLabel} · {acc.txCount} entries
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-sm font-mono font-bold tabular-nums ${
                            acc.signedBalance < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {formatCurrency(acc.signedBalance, currency)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAccountId(String(acc.id));
                            setSearchParams({ accountId: String(acc.id) });
                            handleTabSwitch('ledger');
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/15 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/25 cursor-pointer"
                        >
                          Ledger
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Income & Expense Categories */}
            <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 space-y-5">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Income Accounts
                  </h2>
                  <span className="text-xs font-mono text-slate-500">4000–4999</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {(statements?.chartOfAccounts.incomeCategories ?? []).map((cat) => (
                    <div
                      key={cat.id}
                      className="py-2.5 flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-xs text-slate-400">
                          {cat.code}
                        </span>
                        <span className="font-medium text-slate-800 dark:text-zinc-200 truncate">
                          {cat.name}
                        </span>
                      </div>
                      <span className="font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(
                          scope === 'all' ? cat.allTimeTotal : cat.periodTotal,
                          currency
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-white/[0.08]">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Expense Accounts
                  </h2>
                  <span className="text-xs font-mono text-slate-500">5000–5999</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-white/[0.06] max-h-72 overflow-y-auto pr-1">
                  {(statements?.chartOfAccounts.expenseCategories ?? []).map((cat) => (
                    <div
                      key={cat.id}
                      className="py-2.5 flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-xs text-slate-400">
                          {cat.code}
                        </span>
                        <span className="font-medium text-slate-800 dark:text-zinc-200 truncate">
                          {cat.name}
                        </span>
                      </div>
                      <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-zinc-100">
                        {formatCurrency(
                          scope === 'all' ? cat.allTimeTotal : cat.periodTotal,
                          currency
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ACCOUNT LEDGER */}
        {tab === 'ledger' && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label
                    htmlFor="ledger-wallet-select"
                    className="block text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-1"
                  >
                    Select Wallet / Account
                  </label>
                  <select
                    id="ledger-wallet-select"
                    value={selectedAccountId}
                    onChange={(e) => {
                      setSelectedAccountId(e.target.value);
                      setSearchParams({ accountId: e.target.value });
                    }}
                    className="px-3.5 py-2 text-sm font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-[#09090B] border border-slate-200 dark:border-white/[0.1] rounded-xl"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type}) — {formatCurrency(acc.balance, currency)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="ledger-start"
                    className="block text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-1"
                  >
                    From Date
                  </label>
                  <input
                    id="ledger-start"
                    type="date"
                    value={ledgerStart}
                    onChange={(e) => setLedgerStart(e.target.value)}
                    className="px-3 py-2 text-xs font-mono text-slate-900 dark:text-white bg-slate-50 dark:bg-[#09090B] border border-slate-200 dark:border-white/[0.1] rounded-xl"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ledger-end"
                    className="block text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-1"
                  >
                    To Date
                  </label>
                  <input
                    id="ledger-end"
                    type="date"
                    value={ledgerEnd}
                    onChange={(e) => setLedgerEnd(e.target.value)}
                    className="px-3 py-2 text-xs font-mono text-slate-900 dark:text-white bg-slate-50 dark:bg-[#09090B] border border-slate-200 dark:border-white/[0.1] rounded-xl"
                  />
                </div>
              </div>

              {(ledgerStart || ledgerEnd) && (
                <button
                  type="button"
                  onClick={() => {
                    setLedgerStart('');
                    setLedgerEnd('');
                  }}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Clear Date Range
                </button>
              )}
            </div>

            {ledgerData && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-4">
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Opening Balance
                  </p>
                  <p className="text-lg font-bold font-mono tabular-nums mt-1 text-slate-900 dark:text-white">
                    {formatCurrency(ledgerData.openingBalance, currency)}
                  </p>
                </div>
                <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-4">
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Total Inflows (+)
                  </p>
                  <p className="text-lg font-bold font-mono tabular-nums mt-1 text-emerald-600 dark:text-emerald-400">
                    +{formatCurrency(ledgerData.totalInflow, currency)}
                  </p>
                </div>
                <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-4">
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Total Outflows (-)
                  </p>
                  <p className="text-lg font-bold font-mono tabular-nums mt-1 text-rose-600 dark:text-rose-400">
                    -{formatCurrency(ledgerData.totalOutflow, currency)}
                  </p>
                </div>
                <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-4">
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Closing Balance
                  </p>
                  <p
                    className={`text-lg font-bold font-mono tabular-nums mt-1 ${
                      ledgerData.closingBalance < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {formatCurrency(ledgerData.closingBalance, currency)}
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl overflow-hidden">
              {ledgerLoading ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  Loading wallet ledger...
                </div>
              ) : !ledgerData || ledgerData.entries.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500 dark:text-zinc-400">
                  No ledger entries recorded for this wallet in the selected range.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.03] text-xs font-semibold text-slate-500 dark:text-zinc-400">
                        <th className="py-3.5 pl-6 pr-4">Date &amp; Time</th>
                        <th className="py-3.5 px-4">Particulars</th>
                        <th className="py-3.5 px-4">Category / Flow</th>
                        <th className="py-3.5 px-4 text-right">Inflow (+)</th>
                        <th className="py-3.5 px-4 text-right">Outflow (-)</th>
                        <th className="py-3.5 pl-4 pr-6 text-right">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] text-sm">
                      {ledgerData.entries.map((row) => (
                        <tr
                          key={row.id}
                          className="hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                        >
                          <td className="py-3 pl-6 pr-4 font-mono tabular-nums text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                            <div>{formatDisplayDate(row.date)}</div>
                            <div className="text-[11px] text-slate-400">
                              {formatLoggedTime(row.createdAt)}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                            {row.title}
                            {row.notes && (
                              <p className="text-xs font-normal text-slate-500 dark:text-zinc-400">
                                {row.notes}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 dark:text-zinc-300">
                            {row.counterparty}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                            {row.inflow > 0 ? `+${formatCurrency(row.inflow, currency)}` : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400 font-semibold">
                            {row.outflow > 0 ? `-${formatCurrency(row.outflow, currency)}` : '—'}
                          </td>
                          <td
                            className={`py-3 pl-4 pr-6 text-right font-mono tabular-nums font-bold ${
                              row.runningBalance < 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {formatCurrency(row.runningBalance, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: BALANCE SHEET */}
        {tab === 'balance-sheet' && statements && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Assets (Positive Wallets)
                </h2>
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(statements.balanceSheet.totalAssets, currency)}
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {statements.balanceSheet.assets.length === 0 ? (
                  <p className="py-4 text-xs text-slate-500">
                    No positive-balance wallets currently.
                  </p>
                ) : (
                  statements.balanceSheet.assets.map((a) => (
                    <div
                      key={a.id}
                      className="py-3 flex items-center justify-between text-sm"
                    >
                      <span className="text-slate-700 dark:text-zinc-300">
                        {a.name} ({a.type})
                      </span>
                      <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                        {formatCurrency(a.balance, currency)}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="pt-3 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between font-bold text-sm">
                <span>Total Assets</span>
                <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(statements.balanceSheet.totalAssets, currency)}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Liabilities &amp; Owner Equity
                </h2>
                {statements.balanceSheet.isBalanced && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Balanced</span>
                  </span>
                )}
              </div>

              <div className="divide-y divide-slate-100 dark:divide-white/[0.06] text-sm">
                {statements.balanceSheet.liabilities.map((l) => (
                  <div
                    key={l.id}
                    className="py-3 flex items-center justify-between text-rose-600 dark:text-rose-400"
                  >
                    <span>Overdrawn: {l.name}</span>
                    <span className="font-mono font-semibold tabular-nums">
                      {formatCurrency(l.balance, currency)}
                    </span>
                  </div>
                ))}
                <div className="py-3 flex items-center justify-between">
                  <span className="text-slate-600 dark:text-zinc-400">
                    Opening &amp; Adjusted Wallet Capital
                  </span>
                  <span className="font-mono font-semibold tabular-nums">
                    {formatCurrency(statements.balanceSheet.openingCapital, currency)}
                  </span>
                </div>
                <div className="py-3 flex items-center justify-between">
                  <span className="text-slate-600 dark:text-zinc-400">
                    Retained Earnings (All-Time Net Income − Expense)
                  </span>
                  <span className="font-mono font-semibold tabular-nums">
                    {formatCurrency(statements.balanceSheet.retainedEarnings, currency)}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between font-bold text-sm">
                <span>Total Liabilities + Equity</span>
                <span className="font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                  {formatCurrency(
                    statements.balanceSheet.totalLiabilitiesAndEquity,
                    currency
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PROFIT & LOSS */}
        {tab === 'profit-loss' && statements && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-5">
                <p className="text-xs text-slate-500 dark:text-zinc-400">Total Income</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                  {formatCurrency(statements.profitAndLoss.totalIncome, currency)}
                </p>
              </div>
              <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-5">
                <p className="text-xs text-slate-500 dark:text-zinc-400">Total Expenses</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1">
                  {formatCurrency(statements.profitAndLoss.totalExpense, currency)}
                </p>
              </div>
              <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-5">
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Net Surplus / Savings ({statements.profitAndLoss.savingsRate}%)
                </p>
                <p
                  className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
                    statements.profitAndLoss.netProfit >= 0
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatCurrency(statements.profitAndLoss.netProfit, currency, true)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 space-y-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Income Breakdown
                </h2>
                {statements.profitAndLoss.incomeItems.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4">
                    No income entries recorded for this period.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-white/[0.06] text-sm">
                    {statements.profitAndLoss.incomeItems.map((i) => (
                      <div key={i.id} className="py-2.5 flex justify-between">
                        <span className="text-slate-700 dark:text-zinc-300">{i.name}</span>
                        <span className="font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(
                            scope === 'all' ? i.allTimeTotal : i.periodTotal,
                            currency
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 space-y-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Expense Breakdown
                </h2>
                {statements.profitAndLoss.expenseItems.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4">
                    No expense entries recorded for this period.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-white/[0.06] text-sm">
                    {statements.profitAndLoss.expenseItems.map((e) => (
                      <div key={e.id} className="py-2.5 flex justify-between">
                        <span className="text-slate-700 dark:text-zinc-300">{e.name}</span>
                        <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                          {formatCurrency(
                            scope === 'all' ? e.allTimeTotal : e.periodTotal,
                            currency
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: TRIAL BALANCE */}
        {tab === 'trial-balance' && statements && (
          <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Double-Entry Trial Balance
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Verifies that total Debit balances equal total Credit balances across every wallet &amp; category
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                  statements.trialBalance.isBalanced
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {statements.trialBalance.isBalanced
                    ? 'Debits = Credits (Balanced)'
                    : `Difference: ${formatCurrency(statements.trialBalance.difference, currency)}`}
                </span>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.03] text-xs font-semibold text-slate-500 dark:text-zinc-400">
                    <th className="py-3.5 pl-6 pr-4">Code</th>
                    <th className="py-3.5 px-4">Account Name</th>
                    <th className="py-3.5 px-4">Class</th>
                    <th className="py-3.5 px-4 text-right">Debit</th>
                    <th className="py-3.5 pl-4 pr-6 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] text-sm">
                  {statements.trialBalance.rows.map((row, idx) => (
                    <tr
                      key={`${row.code}-${idx}`}
                      className="hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                    >
                      <td className="py-3 pl-6 pr-4 font-mono text-xs text-slate-400">
                        {row.code}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                        {row.accountName}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 dark:text-zinc-400">
                        {row.group}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                        {row.debit > 0 ? formatCurrency(row.debit, currency) : '—'}
                      </td>
                      <td className="py-3 pl-4 pr-6 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                        {row.credit > 0 ? formatCurrency(row.credit, currency) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 dark:border-white/[0.15] bg-slate-50 dark:bg-white/[0.04] text-sm font-bold">
                    <td colSpan={3} className="py-3.5 pl-6 pr-4 text-slate-900 dark:text-white">
                      Total Trial Balance
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                      {formatCurrency(statements.trialBalance.totalDebits, currency)}
                    </td>
                    <td className="py-3.5 pl-4 pr-6 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                      {formatCurrency(statements.trialBalance.totalCredits, currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
