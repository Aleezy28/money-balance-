import {
  ArrowLeftRight,
  Banknote,
  CreditCard,
  FileText,
  Landmark,
  Pencil,
  Plus,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import api, { getApiErrorMessage } from '../api/axios';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import type { Account, AccountType } from '../types';
import { formatCurrency, toInputDateValue } from '../utils/formatCurrency';

const WALLET_COLORS = [
  '#059669',
  '#2563EB',
  '#4F46E5',
  '#7C3AED',
  '#0D9488',
  '#DB2777',
  '#D97706',
  '#334155',
];

function WalletTypeIcon({ type }: { type: AccountType }) {
  if (type === 'CASH') return <Banknote className="w-5 h-5" />;
  if (type === 'CARD') return <CreditCard className="w-5 h-5" />;
  if (type === 'MOBILE_WALLET') return <Smartphone className="w-5 h-5" />;
  return <Landmark className="w-5 h-5" />;
}

function walletTypeLabel(type: AccountType): string {
  if (type === 'CASH') return 'Cash';
  if (type === 'BANK') return 'Bank Account';
  if (type === 'CARD') return 'Card';
  return 'Mobile Wallet';
}

export default function Wallets() {
  const { currency } = useAuth();
  const { t } = usePreferences();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [totalNetWorth, setTotalNetWorth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add/Edit Wallet Modal
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('BANK');
  const [balance, setBalance] = useState('0');
  const [color, setColor] = useState(WALLET_COLORS[1]);
  const [savingWallet, setSavingWallet] = useState(false);

  // Quick Transfer Modal
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferTitle, setTransferTitle] = useState('Wallet Transfer');
  const [transferDate, setTransferDate] = useState(toInputDateValue());
  const [savingTransfer, setSavingTransfer] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const loadWallets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ accounts: Account[]; totalNetWorth: number }>(
        '/accounts'
      );
      setAccounts(res.data.accounts);
      setTotalNetWorth(res.data.totalNetWorth);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load wallets.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWallets();
  }, [loadWallets]);

  const openAddWallet = () => {
    setEditingWallet(null);
    setName('');
    setType('BANK');
    setBalance('0');
    setColor(WALLET_COLORS[1]);
    setWalletModalOpen(true);
  };

  const openEditWallet = (acc: Account) => {
    setEditingWallet(acc);
    setName(acc.name);
    setType(acc.type);
    setBalance(String(acc.balance));
    setColor(acc.color);
    setWalletModalOpen(true);
  };

  const openTransferModal = () => {
    setFromId(accounts[0] ? String(accounts[0].id) : '');
    setToId(accounts[1] ? String(accounts[1].id) : '');
    setTransferAmount('');
    setTransferTitle('Wallet Transfer');
    setTransferDate(toInputDateValue());
    setTransferModalOpen(true);
  };

  const handleSaveWallet = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Wallet name is required.');
      return;
    }

    setSavingWallet(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        balance: Number(balance) || 0,
        color,
      };
      if (editingWallet) {
        await api.put(`/accounts/${editingWallet.id}`, payload);
      } else {
        await api.post('/accounts', payload);
      }
      setWalletModalOpen(false);
      await loadWallets();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to save wallet.'));
    } finally {
      setSavingWallet(false);
    }
  };

  const handleDeleteWallet = async (id: number) => {
    setError(null);
    try {
      await api.delete(`/accounts/${id}`);
      setConfirmDeleteId(null);
      await loadWallets();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to delete wallet.'));
      setConfirmDeleteId(null);
    }
  };

  const handleTransfer = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const amt = Number(transferAmount);
    if (!fromId || !toId || fromId === toId) {
      setError('Select two different wallets for transfer.');
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Transfer amount must be greater than 0.');
      return;
    }

    setSavingTransfer(true);
    try {
      await api.post('/transactions', {
        title: transferTitle.trim() || 'Wallet Transfer',
        amount: amt,
        type: 'TRANSFER',
        date: transferDate,
        accountId: Number(fromId),
        toAccountId: Number(toId),
      });
      setTransferModalOpen(false);
      await loadWallets();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Transfer failed.'));
    } finally {
      setSavingTransfer(false);
    }
  };

  const positiveAssets = useMemo(
    () =>
      Math.round(
        accounts.reduce((sum, a) => (a.balance > 0 ? sum + a.balance : sum), 0) * 100
      ) / 100,
    [accounts]
  );

  const negativeOverdrawn = useMemo(
    () =>
      Math.round(
        accounts.reduce((sum, a) => (a.balance < 0 ? sum + Math.abs(a.balance) : sum), 0) * 100
      ) / 100,
    [accounts]
  );

  return (
    <Layout
      title={t('wallets.title')}
      subtitle={t('wallets.subtitle')}
      headerAction={
        <div className="flex items-center gap-2.5">
          {accounts.length >= 2 && (
            <button
              type="button"
              onClick={openTransferModal}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              <ArrowLeftRight className="w-4 h-4 text-indigo-500" />
              <span className="hidden sm:inline">Transfer Funds</span>
              <span className="sm:hidden">Transfer</span>
            </button>
          )}
          <button
            type="button"
            onClick={openAddWallet}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-xl hover:from-indigo-500 hover:to-indigo-400 shadow-md shadow-indigo-600/25 transition-all whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Wallet</span>
          </button>
        </div>
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

        {/* Total Net Worth Dimensional Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#111116] via-indigo-950/90 to-[#09090B] text-white p-6 sm:p-8 border border-indigo-500/25 shadow-2xl">
          <div className="pointer-events-none absolute -right-24 -top-24 w-72 h-72 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-indigo-200">
                {t('wallets.netWorthLabel')}
              </p>
              <p className="text-3xl sm:text-4xl font-bold font-mono tabular-nums mt-2 tracking-tight">
                {formatCurrency(totalNetWorth, currency)}
              </p>
              {negativeOverdrawn > 0 && (
                <p className="text-xs text-indigo-200/90 font-mono tabular-nums mt-2">
                  Positive Wallets: {formatCurrency(positiveAssets, currency)} − Overdrawn:{' '}
                  <span className="text-rose-300">
                    {formatCurrency(negativeOverdrawn, currency)}
                  </span>{' '}
                  = {formatCurrency(totalNetWorth, currency)}
                </p>
              )}
            </div>
            <p className="text-xs text-slate-300 font-mono tabular-nums">
              {accounts.length} active account{accounts.length === 1 ? '' : 's'} · {currency}
            </p>
          </div>
        </div>

        {/* 3D Tactile Wallet Cards Grid */}
        {loading && accounts.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-48 rounded-2xl bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {accounts.map((acc) => {
              const refCount =
                (acc._count?.transactions ?? 0) +
                (acc._count?.incomingTransfers ?? 0);
              const isConfirming = confirmDeleteId === acc.id;

              return (
                <div key={acc.id} className="space-y-2.5">
                  {/* 3D Dimensional Card Surface */}
                  <div
                    className="wallet-card-3d relative rounded-2xl p-6 text-white shadow-lg overflow-hidden border border-white/15 min-h-[190px] flex flex-col justify-between"
                    style={{
                      background: `linear-gradient(135deg, ${acc.color} 0%, #0F172A 135%)`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-white/15 backdrop-blur-xs">
                          <WalletTypeIcon type={acc.type} />
                        </div>
                        <div>
                          <h2 className="text-base font-bold tracking-tight">
                            {acc.name}
                          </h2>
                          <p className="text-xs text-white/75">
                            {walletTypeLabel(acc.type)}
                          </p>
                        </div>
                      </div>

                      {/* Subtle tactile card chip */}
                      <div className="w-8 h-6 rounded-md border border-white/30 bg-white/15" />
                    </div>

                    <div className="pt-6 flex items-end justify-between gap-2">
                      <div>
                        <p className="text-[11px] text-white/70">
                          {acc.balance < 0 ? 'Overdrawn Balance' : 'Current Balance'}
                        </p>
                        <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums mt-0.5">
                          {formatCurrency(acc.balance, currency)}
                        </p>
                      </div>
                      <Link
                        to={`/accounts/ledger?accountId=${acc.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-white/15 hover:bg-white/25 rounded-lg text-white transition-colors"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Ledger</span>
                      </Link>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="flex items-center justify-between px-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono tabular-nums">
                      {refCount} linked transaction{refCount === 1 ? '' : 's'}
                    </span>

                    {isConfirming ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleDeleteWallet(acc.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditWallet(acc)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(acc.id)}
                          disabled={refCount > 0}
                          title={
                            refCount > 0
                              ? 'Cannot delete wallet with existing transactions'
                              : 'Delete wallet'
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Wallet Modal */}
      {walletModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setWalletModalOpen(false);
          }}
        >
          <div className="w-full max-w-md bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {editingWallet ? 'Edit Wallet' : 'Add New Wallet'}
              </h2>
              <button
                type="button"
                onClick={() => setWalletModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWallet} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Wallet Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. HBL Savings or JazzCash"
                  required
                  className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Account Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as AccountType)}
                    className="w-full px-3 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank Account</option>
                    <option value="CARD">Card</option>
                    <option value="MOBILE_WALLET">Mobile Wallet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Balance ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Card Color
                </span>
                <div className="flex flex-wrap items-center gap-2.5">
                  {WALLET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-lg cursor-pointer transition-transform ${
                        color === c
                          ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110'
                          : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setWalletModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingWallet}
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl cursor-pointer"
                >
                  {savingWallet ? 'Saving...' : editingWallet ? 'Save Wallet' : 'Create Wallet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Transfer Modal */}
      {transferModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTransferModalOpen(false);
          }}
        >
          <div className="w-full max-w-md bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Transfer Between Wallets
              </h2>
              <button
                type="button"
                onClick={() => setTransferModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  From Wallet
                </label>
                <select
                  value={fromId}
                  onChange={(e) => {
                    const nextFrom = e.target.value;
                    setFromId(nextFrom);
                    if (nextFrom === toId) {
                      const nextTo = accounts.find((a) => String(a.id) !== nextFrom);
                      setToId(nextTo ? String(nextTo.id) : '');
                    }
                  }}
                  className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatCurrency(a.balance, currency)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  To Wallet
                </label>
                <select
                  value={toId}
                  onChange={(e) => setToId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl"
                >
                  {accounts
                    .filter((a) => String(a.id) !== fromId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({formatCurrency(a.balance, currency)})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Amount ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Memo
                </label>
                <input
                  type="text"
                  value={transferTitle}
                  onChange={(e) => setTransferTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTransfer}
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl cursor-pointer"
                >
                  {savingTransfer ? 'Transferring...' : 'Execute Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
