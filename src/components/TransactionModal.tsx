import { AlertTriangle, Mic, Repeat, Square, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import api, { getApiErrorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { useVoiceInput } from '../hooks/useVoiceInput';
import type {
  Account,
  Category,
  RecurringInterval,
  Transaction,
  TransactionType,
} from '../types';
import { formatCurrency, toInputDateValue } from '../utils/formatCurrency';
import {
  parseVoiceTransaction,
  type ParsedVoiceTransaction,
} from '../utils/parseVoiceTransaction';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  accounts: Account[];
  categories: Category[];
  editingTransaction?: Transaction | null;
  defaultType?: TransactionType;
  autoStartVoice?: boolean;
  initialVoiceTranscript?: string;
  initialParsed?: ParsedVoiceTransaction | null;
}

export default function TransactionModal({
  isOpen,
  onClose,
  onSaved,
  accounts,
  categories,
  editingTransaction = null,
  defaultType = 'EXPENSE',
  autoStartVoice = false,
  initialVoiceTranscript = '',
  initialParsed = null,
}: TransactionModalProps) {
  const { currency } = useAuth();
  const { features } = usePreferences();

  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(toInputDateValue());
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] =
    useState<RecurringInterval>('MONTHLY');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyParsedTranscript = useCallback(
    (spoken: string) => {
      const parsed = parseVoiceTransaction(spoken, accounts, categories);
      if (parsed.type) setType(parsed.type);
      if (parsed.title) setTitle(parsed.title);
      if (parsed.amount) setAmount(parsed.amount);
      if (parsed.date) setDate(parsed.date);
      if (parsed.accountId) setAccountId(parsed.accountId);
      if (parsed.toAccountId) setToAccountId(parsed.toAccountId);
      if (parsed.categoryId) setCategoryId(parsed.categoryId);
      if (parsed.notes) setNotes(parsed.notes);
    },
    [accounts, categories]
  );

  const {
    isSupported: voiceSupported,
    isListening,
    transcript: voiceTranscript,
    interimTranscript,
    voiceError,
    startListening,
    stopListening,
    abortListening,
    resetTranscript,
  } = useVoiceInput({
    onTranscriptUpdate: applyParsedTranscript,
    onTranscriptFinal: applyParsedTranscript,
  });

  const filteredCategories = useMemo(
    () =>
      categories.filter((c) => c.type === (type === 'INCOME' ? 'INCOME' : 'EXPENSE')),
    [categories, type]
  );

  useEffect(() => {
    if (!isOpen) {
      abortListening();
      return;
    }
    setError(null);
    resetTranscript();

    if (editingTransaction) {
      setType(editingTransaction.type);
      setTitle(editingTransaction.title);
      setAmount(String(editingTransaction.amount));
      setDate(toInputDateValue(editingTransaction.date));
      setCategoryId(
        editingTransaction.categoryId ? String(editingTransaction.categoryId) : ''
      );
      setAccountId(String(editingTransaction.accountId));
      setToAccountId(
        editingTransaction.toAccountId ? String(editingTransaction.toAccountId) : ''
      );
      setNotes(editingTransaction.notes ?? '');
      setIsRecurring(editingTransaction.isRecurring);
      setRecurringInterval(editingTransaction.recurringInterval || 'MONTHLY');
    } else {
      setType(defaultType);
      setTitle('');
      setAmount('');
      setDate(toInputDateValue());
      // Smart-select funded wallet for expenses/transfers so 0-balance wallets don't accidentally overdraw
      const sortedPositive = [...accounts].sort((a, b) => b.balance - a.balance);
      const preferredSource =
        defaultType === 'INCOME'
          ? accounts[0]
          : sortedPositive.find((a) => a.balance > 0) || accounts[0];
      const preferredDest = accounts.find((a) => a.id !== preferredSource?.id);
      setAccountId(preferredSource ? String(preferredSource.id) : '');
      setToAccountId(preferredDest ? String(preferredDest.id) : '');
      const matchingCat = categories.find(
        (c) => c.type === (defaultType === 'INCOME' ? 'INCOME' : 'EXPENSE')
      );
      setCategoryId(matchingCat ? String(matchingCat.id) : '');
      setNotes('');
      setIsRecurring(false);
      setRecurringInterval('MONTHLY');

      if (initialParsed) {
        if (initialParsed.type) setType(initialParsed.type);
        if (initialParsed.title) setTitle(initialParsed.title);
        if (initialParsed.amount) setAmount(initialParsed.amount);
        if (initialParsed.date) setDate(initialParsed.date);
        if (initialParsed.accountId) setAccountId(initialParsed.accountId);
        if (initialParsed.toAccountId) setToAccountId(initialParsed.toAccountId);
        if (initialParsed.categoryId) setCategoryId(initialParsed.categoryId);
        if (initialParsed.notes) setNotes(initialParsed.notes);
      } else if (initialVoiceTranscript.trim()) {
        applyParsedTranscript(initialVoiceTranscript.trim());
      } else if (autoStartVoice && features.voiceQuickAdd) {
        void startListening();
      }
    }
  }, [
    isOpen,
    editingTransaction,
    defaultType,
    accounts,
    categories,
    autoStartVoice,
    initialVoiceTranscript,
    initialParsed,
    applyParsedTranscript,
    startListening,
    abortListening,
    resetTranscript,
  ]);

  useEffect(() => {
    if (!isOpen || type === 'TRANSFER') return;
    const valid = filteredCategories.some((c) => String(c.id) === categoryId);
    if (!valid) {
      setCategoryId(filteredCategories[0] ? String(filteredCategories[0].id) : '');
    }
  }, [type, filteredCategories, categoryId, isOpen]);

  const handleClose = useCallback(() => {
    abortListening();
    onClose();
  }, [abortListening, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isListening) stopListening();

    const trimmedTitle = title.trim();
    const numericAmount = Number(amount);

    if (!trimmedTitle) {
      setError('Please enter a transaction title.');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Amount must be greater than 0.');
      return;
    }
    if (!accountId) {
      setError('Please select a wallet.');
      return;
    }
    if (type === 'TRANSFER') {
      if (!toAccountId) {
        setError('Please select a destination wallet.');
        return;
      }
      if (toAccountId === accountId) {
        setError('Source and destination wallets must be different.');
        return;
      }
    } else if (!categoryId) {
      setError(`Please select a ${type.toLowerCase()} category.`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: trimmedTitle,
        amount: numericAmount,
        type,
        date,
        accountId: Number(accountId),
        toAccountId: type === 'TRANSFER' ? Number(toAccountId) : null,
        categoryId: type === 'TRANSFER' ? null : Number(categoryId),
        notes: notes.trim() || null,
        isRecurring,
        recurringInterval: isRecurring ? recurringInterval : null,
      };

      if (editingTransaction) {
        await api.put(`/transactions/${editingTransaction.id}`, payload);
      } else {
        await api.post('/transactions', payload);
      }

      onSaved();
      handleClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to save transaction.'));
    } finally {
      setSubmitting(false);
    }
  };

  const liveSpoken = [voiceTranscript, interimTranscript].filter(Boolean).join(' ').trim();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tx-drawer-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            className="w-full max-w-md h-full bg-white dark:bg-[#111114] border-l border-slate-200 dark:border-white/[0.08] shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-white/[0.08] shrink-0">
              <div>
                <h2
                  id="tx-drawer-title"
                  className="text-lg font-bold text-slate-900 dark:text-white"
                >
                  {editingTransaction ? 'Edit Transaction' : 'New Transaction'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Speak or enter details · Balances update automatically
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close drawer"
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex-1 p-6 space-y-5 overflow-y-auto flex flex-col justify-between"
            >
              <div className="space-y-4">
                {/* Web Speech API Voice-to-Text Quick Dictation */}
                {!editingTransaction && features.voiceQuickAdd && (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                          Voice-to-Text Logger
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                          {isListening
                            ? 'Listening... speak amount, item, and wallet'
                            : 'Say e.g. "Spent 1,250 on coffee from cash"'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          isListening ? stopListening() : void startListening()
                        }
                        disabled={!voiceSupported}
                        aria-label={
                          isListening ? 'Stop voice recording' : 'Start voice input'
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition-colors shrink-0 whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                          isListening
                            ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-md shadow-rose-600/25'
                            : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm shadow-indigo-600/20'
                        }`}
                      >
                        {isListening ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-current" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-3.5 h-3.5" />
                            <span>Dictate</span>
                          </>
                        )}
                      </button>
                    </div>

                    {liveSpoken && (
                      <p className="text-xs font-mono text-indigo-700 dark:text-indigo-300 bg-white dark:bg-[#09090B] px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.08]">
                        &ldquo;{liveSpoken}&rdquo;
                      </p>
                    )}

                    {voiceError && (
                      <p
                        role="alert"
                        className="text-xs text-rose-600 dark:text-rose-400"
                      >
                        {voiceError}
                      </p>
                    )}
                  </div>
                )}

                {error && (
                  <div
                    role="alert"
                    className="px-3.5 py-2.5 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl"
                  >
                    {error}
                  </div>
                )}

                {/* Shared layoutId segmented type switcher */}
                <div>
                  <span className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                    Transaction Type
                  </span>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-white/[0.05] rounded-xl border border-slate-200 dark:border-white/[0.06]">
                    {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((t) => {
                      const active = type === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setType(t)}
                          className={`relative py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                            active
                              ? t === 'EXPENSE'
                                ? 'text-rose-600 dark:text-rose-400'
                                : t === 'INCOME'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-indigo-600 dark:text-indigo-400'
                              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {active && (
                            <motion.span
                              layoutId="tx-drawer-type-pill"
                              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                              className="absolute inset-0 rounded-lg bg-white dark:bg-[#1C1C22] shadow-xs"
                            />
                          )}
                          <span className="relative z-10">
                            {t === 'EXPENSE'
                              ? 'Expense'
                              : t === 'INCOME'
                                ? 'Income'
                                : 'Transfer'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="tx-title"
                    className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5"
                  >
                    Title
                  </label>
                  <input
                    id="tx-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      type === 'TRANSFER'
                        ? 'e.g. ATM Withdrawal'
                        : type === 'INCOME'
                          ? 'e.g. Monthly Salary'
                          : 'e.g. Grocery Store'
                    }
                    maxLength={100}
                    required
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="tx-amount"
                      className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5"
                    >
                      Amount ({currency})
                    </label>
                    <input
                      id="tx-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      required
                      className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="tx-date"
                      className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5"
                    >
                      Date
                    </label>
                    <input
                      id="tx-date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="tx-account"
                      className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5"
                    >
                      {type === 'TRANSFER'
                        ? 'From Wallet'
                        : type === 'INCOME'
                          ? 'Deposit Into Wallet'
                          : 'Deduct From Wallet'}
                    </label>
                    <select
                      id="tx-account"
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} — {formatCurrency(acc.balance, currency)}
                        </option>
                      ))}
                    </select>

                    {/* Quick Wallet Balance Chips so user clearly sees which wallet is active */}
                    {accounts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {accounts.map((acc) => {
                          const selected = String(acc.id) === accountId;
                          return (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => setAccountId(String(acc.id))}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                                selected
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-slate-50 dark:bg-white/[0.04] text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-white/[0.08] hover:border-indigo-400'
                              }`}
                            >
                              <span>{acc.name}</span>
                              <span className="font-mono tabular-nums opacity-85">
                                {formatCurrency(acc.balance, currency)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Live Balance Impact Preview & Overdraft Warning */}
                  {(() => {
                    const selectedAcc = accounts.find((a) => String(a.id) === accountId);
                    const numericAmt = Number(amount);
                    if (!selectedAcc || !Number.isFinite(numericAmt) || numericAmt <= 0) {
                      return null;
                    }
                    const signedDelta =
                      type === 'INCOME' ? numericAmt : -numericAmt;
                    const baseAccBalance =
                      editingTransaction && editingTransaction.accountId === selectedAcc.id
                        ? editingTransaction.type === 'INCOME'
                          ? selectedAcc.balance - editingTransaction.amount
                          : selectedAcc.balance + editingTransaction.amount
                        : selectedAcc.balance;
                    const afterBalance =
                      Math.round((baseAccBalance + signedDelta) * 100) / 100;
                    const willOverdraw = type !== 'INCOME' && afterBalance < 0;
                    const fundedAlt = accounts
                      .filter((a) => a.id !== selectedAcc.id && a.balance >= numericAmt)
                      .sort((a, b) => b.balance - a.balance)[0];

                    return (
                      <div
                        className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                          willOverdraw && features.overdraftWarning
                            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                            : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 font-mono tabular-nums">
                          <span>Only {selectedAcc.name} updates:</span>
                          <span className="font-semibold">
                            {formatCurrency(baseAccBalance, currency)} →{' '}
                            <span
                              className={
                                afterBalance < 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }
                            >
                              {formatCurrency(afterBalance, currency)}
                            </span>
                          </span>
                        </div>
                        {willOverdraw && features.overdraftWarning && (
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <span className="inline-flex items-center gap-1.5 text-[11px]">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>
                                {selectedAcc.name} will go negative ({formatCurrency(afterBalance, currency)}).
                              </span>
                            </span>
                            {fundedAlt && (
                              <button
                                type="button"
                                onClick={() => setAccountId(String(fundedAlt.id))}
                                className="px-2 py-0.5 text-[11px] font-semibold bg-amber-600 text-white rounded-md hover:bg-amber-500 cursor-pointer"
                              >
                                Use {fundedAlt.name} ({formatCurrency(fundedAlt.balance, currency)})
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {type === 'TRANSFER' ? (
                    <div>
                      <label
                        htmlFor="tx-to-account"
                        className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5"
                      >
                        To Wallet
                      </label>
                      <select
                        id="tx-to-account"
                        value={toAccountId}
                        onChange={(e) => setToAccountId(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Select destination</option>
                        {accounts
                          .filter((a) => String(a.id) !== accountId)
                          .map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} — {formatCurrency(acc.balance, currency)}
                            </option>
                          ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label
                        htmlFor="tx-category"
                        className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5"
                      >
                        Category
                      </label>
                      <select
                        id="tx-category"
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {filteredCategories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Recurring toggle */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08]">
                  <label className="inline-flex items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-zinc-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <Repeat className="w-4 h-4 text-indigo-500" aria-hidden="true" />
                    <span>Recurring entry</span>
                  </label>

                  {isRecurring && (
                    <select
                      value={recurringInterval}
                      onChange={(e) =>
                        setRecurringInterval(e.target.value as RecurringInterval)
                      }
                      aria-label="Recurring frequency"
                      className="px-2.5 py-1 text-xs font-medium text-slate-800 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-lg"
                    >
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="YEARLY">Yearly</option>
                    </select>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="tx-notes"
                    className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5"
                  >
                    Notes (optional)
                  </label>
                  <textarea
                    id="tx-notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Merchant details or memo..."
                    maxLength={300}
                    className="w-full px-3.5 py-2 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-white/[0.06] rounded-xl hover:bg-slate-200 dark:hover:bg-white/[0.1] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-xl hover:from-indigo-500 hover:to-indigo-400 shadow-lg shadow-indigo-600/25 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {submitting
                    ? 'Saving...'
                    : editingTransaction
                      ? 'Save Changes'
                      : 'Save Transaction'}
                </button>
              </div>
            </form>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
