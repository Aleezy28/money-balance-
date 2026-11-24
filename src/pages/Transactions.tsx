import {
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  Pencil,
  Plus,
  Repeat,
  RotateCcw,
  Search,
  Table2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import api, { getApiErrorMessage } from '../api/axios';
import { CategoryIcon } from '../components/CategoryIcon';
import Layout from '../components/Layout';
import TransactionModal from '../components/TransactionModal';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import type { Account, Category, Transaction, TransactionType } from '../types';
import {
  formatCurrency,
  formatDayHeading,
  formatDisplayDate,
  formatLoggedTime,
} from '../utils/formatCurrency';
import { downloadMonthlyPdfReport } from '../utils/generatePdfReport';

export default function Transactions() {
  const { currency } = useAuth();
  const { features, t } = usePreferences();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [viewMode, setViewMode] = useState<'daily' | 'table'>('daily');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [categoryId, setCategoryId] = useState('all');
  const [accountId, setAccountId] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'title'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // CSV Import Modal
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importAccountId, setImportAccountId] = useState('');
  const [importing, setImporting] = useState(false);

  const loadMeta = useCallback(async () => {
    const [accRes, catRes] = await Promise.all([
      api.get<{ accounts: Account[] }>('/accounts'),
      api.get<{ categories: Category[] }>('/categories'),
    ]);
    setAccounts(accRes.data.accounts);
    setCategories(catRes.data.categories);
    if (!importAccountId && accRes.data.accounts[0]) {
      setImportAccountId(String(accRes.data.accounts[0].id));
    }
  }, [importAccountId]);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        page,
        limit: 12,
        sortBy,
        sortOrder,
      };
      if (typeFilter !== 'ALL') params.type = typeFilter;
      if (categoryId !== 'all') params.categoryId = categoryId;
      if (accountId !== 'all') params.accountId = accountId;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (minAmount.trim() !== '') params.minAmount = minAmount.trim();
      if (maxAmount.trim() !== '') params.maxAmount = maxAmount.trim();
      if (search.trim()) params.search = search.trim();

      const res = await api.get<{
        transactions: Transaction[];
        total: number;
        page: number;
        totalPages: number;
      }>('/transactions', { params });

      setTransactions(res.data.transactions);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load transactions.'));
    } finally {
      setLoading(false);
    }
  }, [
    page,
    sortBy,
    sortOrder,
    typeFilter,
    categoryId,
    accountId,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    search,
  ]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        return;
      }
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const toggleSort = (col: 'date' | 'amount' | 'title') => {
    if (sortBy === col) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(col);
      setSortOrder(col === 'title' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const resetFilters = () => {
    setSearch('');
    setTypeFilter('ALL');
    setCategoryId('all');
    setAccountId('all');
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setPage(1);
  };

  const applyDatePreset = (preset: 'all' | 'today' | '7d' | 'month') => {
    const toLocalIso = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const now = new Date();
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const today = toLocalIso(now);
      setStartDate(today);
      setEndDate(today);
    } else if (preset === '7d') {
      const from = new Date(now);
      from.setDate(now.getDate() - 6);
      setStartDate(toLocalIso(from));
      setEndDate(toLocalIso(now));
    } else if (preset === 'month') {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toLocalIso(from));
      setEndDate(toLocalIso(now));
    }
    setPage(1);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count += 1;
    if (typeFilter !== 'ALL') count += 1;
    if (categoryId !== 'all') count += 1;
    if (accountId !== 'all') count += 1;
    if (startDate || endDate) count += 1;
    if (minAmount.trim() !== '' || maxAmount.trim() !== '') count += 1;
    return count;
  }, [search, typeFilter, categoryId, accountId, startDate, endDate, minAmount, maxAmount]);

  const handleDelete = async (id: number) => {
    setError(null);
    try {
      await api.delete(`/transactions/${id}`);
      setConfirmDeleteId(null);
      await Promise.all([loadTransactions(), loadMeta()]);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to delete transaction.'));
    }
  };

  const handleExportCsv = async () => {
    try {
      const params: Record<string, string> = {};
      if (typeFilter !== 'ALL') params.type = typeFilter;
      if (categoryId !== 'all') params.categoryId = categoryId;
      if (accountId !== 'all') params.accountId = accountId;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (minAmount.trim() !== '') params.minAmount = minAmount.trim();
      if (maxAmount.trim() !== '') params.maxAmount = maxAmount.trim();
      if (search.trim()) params.search = search.trim();

      const res = await api.get('/transactions/export/csv', {
        params,
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'multi-wallet-transactions.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getApiErrorMessage(err, 'CSV export failed.'));
    }
  };

  const handleCsvFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCsvText(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setImporting(true);
    try {
      const res = await api.post<{ message: string }>('/transactions/import/csv', {
        csvText,
        defaultAccountId: importAccountId ? Number(importAccountId) : undefined,
      });
      setImportOpen(false);
      setCsvText('');
      setNotice(res.data.message);
      setPage(1);
      await Promise.all([loadTransactions(), loadMeta()]);
    } catch (err) {
      setError(getApiErrorMessage(err, 'CSV import failed.'));
    } finally {
      setImporting(false);
    }
  };

  const groupedByDay = useMemo(() => {
    const map = new Map<
      string,
      {
        dayKey: string;
        heading: string;
        expenseCents: number;
        incomeCents: number;
        items: Transaction[];
      }
    >();
    for (const tx of transactions) {
      const dayKey = tx.date.slice(0, 10);
      let group = map.get(dayKey);
      if (!group) {
        group = {
          dayKey,
          heading: formatDayHeading(tx.date),
          expenseCents: 0,
          incomeCents: 0,
          items: [],
        };
        map.set(dayKey, group);
      }
      const amtCents = Math.round(tx.amount * 100);
      if (tx.type === 'EXPENSE') group.expenseCents += amtCents;
      else if (tx.type === 'INCOME') group.incomeCents += amtCents;
      group.items.push(tx);
    }
    return Array.from(map.values());
  }, [transactions]);

  return (
    <Layout
      title={t('transactions.title')}
      subtitle={t('transactions.subtitle')}
      headerAction={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </button>
          {features.pdfReports && (
            <button
              type="button"
              onClick={() => {
                const refDate = startDate ? new Date(startDate) : new Date();
                void downloadMonthlyPdfReport(
                  refDate.getMonth() + 1,
                  refDate.getFullYear(),
                  currency
                );
              }}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.1] rounded-xl hover:border-indigo-500 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-indigo-500" />
              <span>PDF Report</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleExportCsv()}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingTx(null);
              setTxModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-xl hover:from-indigo-500 hover:to-indigo-400 shadow-md shadow-indigo-600/25 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Add Entry</span>
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {notice && (
          <div className="flex items-center justify-between px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-xs font-semibold underline cursor-pointer"
            >
              Dismiss
            </button>
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

        {/* Global Search & Multi-Criteria Filter Bar */}
        <section
          aria-label="Global transaction search"
          className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-sm"
        >
          {/* Row 1: Global Search Input + Type Segmented Control */}
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                aria-label="Global search by merchant name, amount, date, category, or wallet"
                placeholder="Search merchant name, amount (e.g. 3000 or 500-2000), date (YYYY-MM-DD), or wallet..."
                className="w-full pl-10 pr-20 py-2.5 text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-[#09090B] border border-slate-200 dark:border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {search ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setPage(1);
                    }}
                    aria-label="Clear search query"
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.1] rounded">
                    /
                  </kbd>
                )}
              </div>
            </div>

            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
              {(['ALL', 'INCOME', 'EXPENSE', 'TRANSFER'] as const).map((tp) => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => {
                    setTypeFilter(tp);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    typeFilter === tp
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tp === 'ALL'
                    ? 'All'
                    : tp === 'INCOME'
                      ? 'Income'
                      : tp === 'EXPENSE'
                        ? 'Expense'
                        : 'Transfer'}
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: Date Range, Amount Range, Category, Wallet & View Switch */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Date Range Inputs + Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 dark:bg-[#09090B] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs">
              <span className="font-medium text-slate-500 dark:text-zinc-400">Date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter from date"
                className="bg-transparent font-mono text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
              />
              <span className="text-slate-400">–</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter to date"
                className="bg-transparent font-mono text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
              />
              <div className="hidden sm:flex items-center gap-1 pl-1.5 border-l border-slate-200 dark:border-white/[0.08]">
                {(
                  [
                    { id: 'today', label: 'Today' },
                    { id: '7d', label: '7D' },
                    { id: 'month', label: 'Month' },
                    { id: 'all', label: 'Any' },
                  ] as const
                ).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyDatePreset(preset.id)}
                    className="px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Range Inputs */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 dark:bg-[#09090B] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs">
              <span className="font-medium text-slate-500 dark:text-zinc-400">Amount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={minAmount}
                onChange={(e) => {
                  setMinAmount(e.target.value);
                  setPage(1);
                }}
                placeholder="Min"
                aria-label="Minimum amount"
                className="w-20 bg-transparent font-mono tabular-nums text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none"
              />
              <span className="text-slate-400">–</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={maxAmount}
                onChange={(e) => {
                  setMaxAmount(e.target.value);
                  setPage(1);
                }}
                placeholder="Max"
                aria-label="Maximum amount"
                className="w-20 bg-transparent font-mono tabular-nums text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by category"
              className="px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-[#09090B] border border-slate-200 dark:border-white/[0.08] rounded-xl"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>

            <select
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by wallet"
              className="px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-[#09090B] border border-slate-200 dark:border-white/[0.08] rounded-xl"
            >
              <option value="all">All Wallets</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-500/20 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear ({activeFilterCount})</span>
              </button>
            )}

            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl ml-auto">
              <button
                type="button"
                onClick={() => setViewMode('daily')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
                  viewMode === 'daily'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>By Day</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Table2 className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
            </div>

            <div className="sm:hidden flex items-center gap-2">
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="px-2.5 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                Import
              </button>
              <button
                type="button"
                onClick={() => void handleExportCsv()}
                className="px-2.5 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                Export
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 pt-1 border-t border-slate-100 dark:border-white/[0.06]">
            <span>
              {total} {total === 1 ? 'matching transaction' : 'matching transactions'}
              {activeFilterCount > 0 ? ` · ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active` : ''}
            </span>
            <span className="hidden sm:inline">
              Tip: Search merchant, <span className="font-mono">3000</span>, <span className="font-mono">500-2000</span>, or <span className="font-mono">2026-11-23</span>
            </span>
          </div>
        </section>

        {/* Ledger Table or Day-by-Day Timeline */}
        <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-sm">
          {loading && transactions.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Loading ledger...
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                No transactions match your filters
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-3 px-4 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/15 rounded-xl cursor-pointer"
              >
                Clear Filters
              </button>
            </div>
          ) : viewMode === 'daily' ? (
            <>
              <div className="divide-y divide-slate-200 dark:divide-white/[0.08]">
                {groupedByDay.map((group) => (
                  <div key={group.dayKey}>
                    <div className="px-5 py-3 bg-slate-50/90 dark:bg-white/[0.03] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <CalendarDays className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          {group.heading}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-zinc-400">
                          · {group.items.length} entr{group.items.length === 1 ? 'y' : 'ies'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                        {group.incomeCents > 0 && (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            In: +{formatCurrency(group.incomeCents / 100, currency)}
                          </span>
                        )}
                        {group.expenseCents > 0 && (
                          <span className="font-semibold text-rose-600 dark:text-rose-400">
                            Spent: -{formatCurrency(group.expenseCents / 100, currency)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                      {group.items.map((tx) => {
                        const isIncome = tx.type === 'INCOME';
                        const isTransfer = tx.type === 'TRANSFER';
                        const isConfirming = confirmDeleteId === tx.id;
                        return (
                          <div
                            key={tx.id}
                            className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              <span
                                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                style={{
                                  backgroundColor: `${tx.category?.color || '#4F46E5'}1F`,
                                  color: tx.category?.color || '#4F46E5',
                                }}
                              >
                                <CategoryIcon
                                  name={tx.category?.icon || 'Tag'}
                                  className="w-4 h-4"
                                />
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                    {tx.title}
                                  </p>
                                  {tx.isRecurring && (
                                    <Repeat className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                                  {isTransfer
                                    ? `${tx.account.name} → ${tx.toAccount?.name || ''}`
                                    : `${tx.category?.name || 'Uncategorized'} · ${tx.account.name}`}
                                  {' · '}
                                  <span className="font-mono">
                                    {formatDisplayDate(tx.date)} {formatLoggedTime(tx.createdAt)}
                                  </span>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span
                                className={`text-sm font-mono tabular-nums font-bold ${
                                  isIncome
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : isTransfer
                                      ? 'text-indigo-600 dark:text-indigo-400'
                                      : 'text-slate-900 dark:text-zinc-100'
                                }`}
                              >
                                {isIncome ? '+' : isTransfer ? '' : '-'}
                                {formatCurrency(tx.amount, currency)}
                              </span>

                              {isConfirming ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => void handleDelete(tx.id)}
                                    className="px-2.5 py-1 text-xs font-semibold text-white bg-rose-600 rounded-lg cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingTx(tx);
                                      setTxModalOpen(true);
                                    }}
                                    aria-label={`Edit ${tx.title}`}
                                    className="p-2 text-slate-400 hover:text-indigo-500 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(tx.id)}
                                    aria-label={`Delete ${tx.title}`}
                                    className="p-2 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-6 py-3.5 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono tabular-nums">
                  {total} total record{total === 1 ? '' : 's'} · Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-slate-800/40 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <th className="py-3.5 pl-6 pr-4">
                        <button
                          type="button"
                          onClick={() => toggleSort('date')}
                          className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        >
                          <span>Date</span>
                          <ArrowUpDown className="w-3.5 h-3.5" />
                        </button>
                      </th>
                      <th className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => toggleSort('title')}
                          className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        >
                          <span>Description</span>
                          <ArrowUpDown className="w-3.5 h-3.5" />
                        </button>
                      </th>
                      <th className="py-3.5 px-4">Category / Flow</th>
                      <th className="py-3.5 px-4">Wallet</th>
                      <th className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => toggleSort('amount')}
                          className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer ml-auto"
                        >
                          <span>Amount</span>
                          <ArrowUpDown className="w-3.5 h-3.5" />
                        </button>
                      </th>
                      <th className="py-3.5 pl-4 pr-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] text-sm">
                    {transactions.map((tx) => {
                      const isIncome = tx.type === 'INCOME';
                      const isTransfer = tx.type === 'TRANSFER';
                      const isConfirming = confirmDeleteId === tx.id;

                      return (
                        <tr
                          key={tx.id}
                          className="hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                        >
                          <td className="py-3.5 pl-6 pr-4 font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            <div>{formatDisplayDate(tx.date)}</div>
                            <div className="text-[11px] text-slate-400">
                              {formatLoggedTime(tx.createdAt)}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 min-w-[200px]">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {tx.title}
                              </span>
                              {tx.isRecurring && (
                                <Repeat
                                  className="w-3.5 h-3.5 text-indigo-500 shrink-0"
                                  aria-label={`Recurring ${tx.recurringInterval || ''}`}
                                />
                              )}
                            </div>
                            {tx.notes && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                {tx.notes}
                              </p>
                            )}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {isTransfer ? (
                              <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                                Transfer
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                <span
                                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                                  style={{
                                    backgroundColor: `${tx.category?.color || '#64748B'}20`,
                                    color: tx.category?.color || '#64748B',
                                  }}
                                >
                                  <CategoryIcon
                                    name={tx.category?.icon}
                                    className="w-3.5 h-3.5"
                                  />
                                </span>
                                <span>{tx.category?.name}</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                            {isTransfer
                              ? `${tx.account.name} → ${tx.toAccount?.name || ''}`
                              : tx.account.name}
                          </td>
                          <td
                            className={`py-3.5 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                              isIncome
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : isTransfer
                                  ? 'text-indigo-600 dark:text-indigo-400'
                                  : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {isIncome ? '+' : isTransfer ? '' : '-'}
                            {formatCurrency(tx.amount, currency)}
                          </td>
                          <td className="py-3.5 pl-4 pr-6 text-right whitespace-nowrap">
                            {isConfirming ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => void handleDelete(tx.id)}
                                  className="px-2.5 py-1 text-xs font-semibold text-white bg-rose-600 rounded-lg cursor-pointer"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingTx(tx);
                                    setTxModalOpen(true);
                                  }}
                                  aria-label={`Edit ${tx.title}`}
                                  className="p-2 text-slate-400 hover:text-indigo-500 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(tx.id)}
                                  aria-label={`Delete ${tx.title}`}
                                  className="p-2 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="px-6 py-3.5 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono tabular-nums">
                  {total} total record{total === 1 ? '' : 's'} · Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <TransactionModal
        isOpen={txModalOpen}
        onClose={() => {
          setTxModalOpen(false);
          setEditingTx(null);
        }}
        onSaved={() => {
          void loadTransactions();
          void loadMeta();
        }}
        accounts={accounts}
        categories={categories}
        editingTransaction={editingTx}
      />

      {/* Bulk CSV Import Modal */}
      {importOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setImportOpen(false);
          }}
        >
          <div className="w-full max-w-lg bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Bulk Import CSV Transactions
              </h2>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="p-6 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Columns: date, title, type, amount, category, account, notes</span>
                <button
                  type="button"
                  onClick={() =>
                    setCsvText(
                      `date,title,type,amount,category,account,notes\n2026-11-18,Client Bonus,INCOME,25000,Freelance,Meezan Bank,Q4 deliverable\n2026-11-19,Coffee & Snacks,EXPENSE,1450,Food & Dining,Cash Wallet,Morning espresso`
                    )
                  }
                  className="font-semibold text-indigo-500 hover:underline cursor-pointer"
                >
                  Load Sample CSV
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Upload .csv file
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileUpload}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-500/20 file:text-indigo-600 dark:file:text-indigo-300 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Default Wallet (if account column omitted)
                </label>
                <select
                  value={importAccountId}
                  onChange={(e) => setImportAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  CSV Content
                </label>
                <textarea
                  rows={6}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="date,title,type,amount,category,account,notes"
                  required
                  className="w-full px-3.5 py-2.5 text-xs font-mono text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setImportOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importing}
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl cursor-pointer"
                >
                  {importing ? 'Importing...' : 'Import Transactions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
