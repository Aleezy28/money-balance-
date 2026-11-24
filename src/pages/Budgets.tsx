import { BadgeDelta, Card, Metric, ProgressBar, type Color } from '@tremor/react';
import { AlertTriangle, CheckCircle2, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import api, { getApiErrorMessage } from '../api/axios';
import { CategoryIcon } from '../components/CategoryIcon';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import type { BudgetItem, Category } from '../types';
import { formatCurrency, MONTH_OPTIONS } from '../utils/formatCurrency';

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function fromCents(cents: number): number {
  return cents / 100;
}

export default function Budgets() {
  const { currency } = useAuth();
  const now = useMemo(() => new Date(), []);

  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());

  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const yearOptions = useMemo(() => {
    const base = now.getFullYear();
    return [base - 1, base, base + 1];
  }, [now]);

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'EXPENSE'),
    [categories]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bRes, cRes] = await Promise.all([
        api.get<{ budgets: BudgetItem[] }>('/budgets', { params: { month, year } }),
        api.get<{ categories: Category[] }>('/categories'),
      ]);
      setBudgets(bRes.data.budgets);
      setCategories(cRes.data.categories);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load monthly budgets.'));
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openModal = (presetCategoryId?: number, presetAmount?: number) => {
    setCategoryId(
      presetCategoryId
        ? String(presetCategoryId)
        : expenseCategories[0]
          ? String(expenseCategories[0].id)
          : ''
    );
    setAmount(presetAmount ? String(presetAmount) : '');
    setModalOpen(true);
  };

  const handleSaveBudget = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const num = Math.round(Number(amount) * 100) / 100;
    if (!categoryId || !Number.isFinite(num) || num <= 0) {
      setError('Select a category and enter a positive budget limit.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/budgets', {
        categoryId: Number(categoryId),
        amount: num,
        month,
        year,
      });
      setModalOpen(false);
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to save budget.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setError(null);
    try {
      await api.delete(`/budgets/${id}`);
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to delete budget.'));
    }
  };

  const totalBudgetedCents = budgets.reduce((s, b) => s + toCents(b.amount), 0);
  const totalSpentCents = budgets.reduce((s, b) => s + toCents(b.spent), 0);
  const totalBudgeted = fromCents(totalBudgetedCents);
  const totalSpent = fromCents(totalSpentCents);
  const totalRemaining = fromCents(totalBudgetedCents - totalSpentCents);
  const overallUtilization =
    totalBudgetedCents > 0
      ? Math.round((totalSpentCents / totalBudgetedCents) * 1000) / 10
      : 0;

  const cardSurfaceClass =
    'bg-white dark:bg-[#111114] ring-1 ring-slate-200 dark:ring-white/[0.08] rounded-2xl shadow-sm';

  return (
    <Layout
      title="Monthly Budgets"
      subtitle="Track category spending limits with Tremor progress bars and 80% / 100% threshold alerts"
      headerAction={
        <button
          type="button"
          onClick={() => openModal()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-600/25 cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Set Budget</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Period Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              aria-label="Select budget month"
              className="px-3.5 py-2 text-sm font-medium text-slate-900 dark:text-white bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-xl"
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
              aria-label="Select budget year"
              className="px-3.5 py-2 text-sm font-mono font-medium text-slate-900 dark:text-white bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-xl"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tremor Summary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className={`${cardSurfaceClass} p-5 space-y-1.5`}>
            <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
              Total Allocated
            </p>
            <Metric className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(totalBudgeted, currency)}
            </Metric>
          </Card>

          <Card className={`${cardSurfaceClass} p-5 space-y-1.5`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                Total Spent
              </p>
              <BadgeDelta
                deltaType={
                  overallUtilization >= 100
                    ? 'increase'
                    : overallUtilization >= 80
                      ? 'moderateIncrease'
                      : 'decrease'
                }
                isIncreasePositive={false}
                size="xs"
              >
                {overallUtilization}% used
              </BadgeDelta>
            </div>
            <Metric className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(totalSpent, currency)}
            </Metric>
          </Card>

          <Card className={`${cardSurfaceClass} p-5 space-y-2.5`}>
            <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
              {totalRemaining >= 0 ? 'Remaining Headroom' : 'Over Budget'}
            </p>
            <Metric
              className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${
                totalRemaining >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatCurrency(Math.abs(totalRemaining), currency)}
            </Metric>
            <ProgressBar
              value={Math.min(100, overallUtilization)}
              color={
                overallUtilization >= 100
                  ? 'rose'
                  : overallUtilization >= 80
                    ? 'amber'
                    : 'emerald'
              }
              showAnimation={true}
            />
          </Card>
        </div>

        {error && (
          <div
            role="alert"
            className="px-4 py-3 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl"
          >
            {error}
          </div>
        )}

        {loading && budgets.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading budgets...
          </div>
        ) : budgets.length === 0 ? (
          <Card className={`${cardSurfaceClass} p-12 text-center`}>
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              No category budgets set for{' '}
              {MONTH_OPTIONS.find((m) => m.value === month)?.label} {year}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Assign monthly limits to expense categories to receive automatic threshold alerts.
            </p>
            <button
              type="button"
              onClick={() => openModal()}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-500 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Budget</span>
            </button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {budgets.map((b) => {
              const barColor: Color =
                b.status === 'EXCEEDED'
                  ? 'rose'
                  : b.status === 'WARNING'
                    ? 'amber'
                    : 'emerald';
              const statusText =
                b.status === 'EXCEEDED'
                  ? 'Over Budget'
                  : b.status === 'WARNING'
                    ? 'Near Limit'
                    : 'On Track';
              const statusClass =
                b.status === 'EXCEEDED'
                  ? 'text-rose-600 dark:text-rose-400'
                  : b.status === 'WARNING'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400';

              return (
                <Card key={b.id} className={`${cardSurfaceClass} p-6 space-y-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `${b.category.color}20`,
                          color: b.category.color,
                        }}
                      >
                        <CategoryIcon name={b.category.icon} className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                          {b.category.name}
                        </h2>
                        <div className={`flex items-center gap-1.5 text-xs font-semibold ${statusClass}`}>
                          {b.status === 'OK' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          )}
                          <span>{statusText}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <BadgeDelta
                        deltaType={
                          b.status === 'EXCEEDED'
                            ? 'increase'
                            : b.status === 'WARNING'
                              ? 'moderateIncrease'
                              : 'decrease'
                        }
                        isIncreasePositive={false}
                        size="xs"
                      >
                        {b.percentage}%
                      </BadgeDelta>
                      <button
                        type="button"
                        onClick={() => openModal(b.categoryId, b.amount)}
                        className="px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/15 rounded-lg cursor-pointer"
                      >
                        Adjust
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(b.id)}
                        aria-label={`Delete ${b.category.name} budget`}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <ProgressBar
                    value={Math.min(100, b.percentage)}
                    color={barColor}
                    showAnimation={true}
                  />

                  <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    <span>
                      Spent:{' '}
                      <strong className="text-slate-900 dark:text-white">
                        {formatCurrency(b.spent, currency)}
                      </strong>
                    </span>
                    <span>
                      {b.remaining >= 0
                        ? `Remaining: ${formatCurrency(b.remaining, currency)}`
                        : `Exceeded by ${formatCurrency(Math.abs(b.remaining), currency)}`}
                    </span>
                    <span>Limit: {formatCurrency(b.amount, currency)}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="w-full max-w-md bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Set Monthly Budget
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Expense Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl"
                >
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Monthly Limit ({currency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 25000"
                  required
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
