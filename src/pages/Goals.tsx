import { Calendar, Coins, Pencil, Plus, Target, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import api, { getApiErrorMessage } from '../api/axios';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import type { Account, SavingsGoal } from '../types';
import { formatCurrency, formatDisplayDate, toInputDateValue } from '../utils/formatCurrency';

const GOAL_COLORS = ['#059669', '#4F46E5', '#0284C7', '#D97706', '#DB2777', '#7C3AED'];

export default function Goals() {
  const { currency } = useAuth();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create / Edit Goal Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('0');
  const [deadline, setDeadline] = useState('');
  const [color, setColor] = useState(GOAL_COLORS[0]);
  const [saving, setSaving] = useState(false);

  // Contribution Modal
  const [contribGoal, setContribGoal] = useState<SavingsGoal | null>(null);
  const [contribAmount, setContribAmount] = useState('');
  const [contribAccountId, setContribAccountId] = useState('');
  const [contributing, setContributing] = useState(false);

  const loadGoals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [gRes, aRes] = await Promise.all([
        api.get<{ goals: SavingsGoal[] }>('/goals'),
        api.get<{ accounts: Account[] }>('/accounts'),
      ]);
      setGoals(gRes.data.goals);
      setAccounts(aRes.data.accounts);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load savings goals.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGoals();
  }, [loadGoals]);

  const openCreate = () => {
    setEditingGoal(null);
    setTitle('');
    setTargetAmount('');
    setCurrentAmount('0');
    setDeadline('');
    setColor(GOAL_COLORS[0]);
    setModalOpen(true);
  };

  const openEdit = (g: SavingsGoal) => {
    setEditingGoal(g);
    setTitle(g.title);
    setTargetAmount(String(g.targetAmount));
    setCurrentAmount(String(g.currentAmount));
    setDeadline(g.deadline ? toInputDateValue(g.deadline) : '');
    setColor(g.color);
    setModalOpen(true);
  };

  const handleSaveGoal = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const target = Math.round(Number(targetAmount) * 100) / 100;
    const current = Math.round((Number(currentAmount) || 0) * 100) / 100;
    if (!title.trim() || !Number.isFinite(target) || target <= 0) {
      setError('Enter a goal title and a positive target amount.');
      return;
    }
    if (!Number.isFinite(current) || current < 0) {
      setError('Saved amount cannot be negative.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        targetAmount: target,
        currentAmount: current,
        deadline: deadline || null,
        color,
      };
      if (editingGoal) {
        await api.put(`/goals/${editingGoal.id}`, payload);
      } else {
        await api.post('/goals', payload);
      }
      setModalOpen(false);
      await loadGoals();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to save savings goal.'));
    } finally {
      setSaving(false);
    }
  };

  const handleContribute = async (e: FormEvent) => {
    e.preventDefault();
    if (!contribGoal) return;
    setError(null);
    const amt = Math.round(Number(contribAmount) * 100) / 100;
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Contribution must be greater than 0.');
      return;
    }

    setContributing(true);
    try {
      await api.post(`/goals/${contribGoal.id}/contribute`, {
        amount: amt,
        accountId: contribAccountId ? Number(contribAccountId) : null,
      });
      setContribGoal(null);
      setContribAmount('');
      await loadGoals();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to add contribution.'));
    } finally {
      setContributing(false);
    }
  };

  const handleDelete = async (id: number) => {
    setError(null);
    try {
      await api.delete(`/goals/${id}`);
      await loadGoals();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to delete goal.'));
    }
  };

  return (
    <Layout
      title="Savings Goals"
      subtitle="Set target milestones, track completion progress, and contribute from your wallets"
      headerAction={
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-xl hover:from-indigo-500 hover:to-indigo-400 shadow-md shadow-indigo-600/25 cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>New Goal</span>
        </button>
      }
    >
      <div className="space-y-6">
        {error && (
          <div
            role="alert"
            className="px-4 py-3 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl"
          >
            {error}
          </div>
        )}

        {loading && goals.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading savings goals...
          </div>
        ) : goals.length === 0 ? (
          <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-12 text-center shadow-sm">
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              No savings goals created yet
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Goal</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {goals.map((g) => {
              const pct =
                g.targetAmount > 0
                  ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 1000) / 10)
                  : 0;
              const remaining = Math.max(0, g.targetAmount - g.currentAmount);

              return (
                <div
                  key={g.id}
                  className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-sm flex flex-col justify-between gap-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `${g.color}20`,
                          color: g.color,
                        }}
                      >
                        <Target className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                          {g.title}
                        </h2>
                        {g.deadline ? (
                          <p className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                            <Calendar className="w-3 h-3" />
                            <span>Target: {formatDisplayDate(g.deadline)}</span>
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Open-ended milestone
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(g)}
                        aria-label={`Edit ${g.title}`}
                        className="p-1.5 text-slate-400 hover:text-indigo-500 rounded-lg cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(g.id)}
                        aria-label={`Delete ${g.title}`}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-baseline justify-between font-mono tabular-nums">
                      <span className="text-xl font-bold text-slate-900 dark:text-white">
                        {formatCurrency(g.currentAmount, currency)}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {pct}% of {formatCurrency(g.targetAmount, currency)}
                      </span>
                    </div>

                    <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%`, backgroundColor: g.color }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {remaining === 0
                        ? 'Goal achieved!'
                        : `${formatCurrency(remaining, currency)} to go`}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setContribGoal(g);
                        setContribAmount('');
                        setContribAccountId('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-sm cursor-pointer"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>Add Contribution</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Goal Modal */}
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
                {editingGoal ? 'Edit Savings Goal' : 'Create Savings Goal'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Goal Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Emergency Fund"
                  required
                  className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Target ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Saved So Far
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Target Date (optional)
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl"
                />
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Accent Color
                </span>
                <div className="flex flex-wrap gap-2.5">
                  {GOAL_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-lg cursor-pointer ${
                        color === c ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
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
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Contribution Modal */}
      {contribGoal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setContribGoal(null);
          }}
        >
          <div className="w-full max-w-md bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Contribute to {contribGoal.title}
              </h2>
              <button
                type="button"
                onClick={() => setContribGoal(null)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleContribute} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Contribution Amount ({currency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={contribAmount}
                  onChange={(e) => setContribAmount(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Deduct from Wallet (optional)
                </label>
                <select
                  value={contribAccountId}
                  onChange={(e) => setContribAccountId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl"
                >
                  <option value="">Track contribution only (no wallet deduction)</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatCurrency(a.balance, currency)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setContribGoal(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={contributing}
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl cursor-pointer"
                >
                  {contributing ? 'Adding...' : 'Add Funds'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
