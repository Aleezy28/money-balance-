import {
  ArrowLeftRight,
  BookCheck,
  BookOpen,
  FileDown,
  FileText,
  Keyboard,
  Layers,
  LayoutDashboard,
  ListChecks,
  Moon,
  PiggyBank,
  Scale,
  Search,
  Settings,
  Sun,
  Target,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { useTheme } from '../context/ThemeContext';
import { downloadMonthlyPdfReport } from '../utils/generatePdfReport';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenShortcuts?: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  section: 'Navigate' | 'Quick Actions';
  hint?: string;
  icon: LucideIcon;
  action: () => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  onOpenShortcuts,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const { currency } = useAuth();
  const { features } = usePreferences();
  const { isDark, toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const items = useMemo<CommandItem[]>(() => {
    const now = new Date();
    const m = now.getMonth() + 1;
    const y = now.getFullYear();

    const list: CommandItem[] = [
      {
        id: 'nav-dashboard',
        label: 'Go to Dashboard',
        section: 'Navigate',
        hint: 'G D',
        icon: LayoutDashboard,
        action: () => {
          navigate('/dashboard');
          onClose();
        },
      },
      {
        id: 'nav-wallets',
        label: 'Go to Cash / Bank & Wallets',
        section: 'Navigate',
        hint: 'G W',
        icon: Wallet,
        action: () => {
          navigate('/wallets');
          onClose();
        },
      },
      {
        id: 'nav-transactions',
        label: 'Go to Expenses & Entries',
        section: 'Navigate',
        hint: 'G E',
        icon: ArrowLeftRight,
        action: () => {
          navigate('/transactions');
          onClose();
        },
      },
    ];

    if (features.accountingModule) {
      list.push(
        {
          id: 'nav-chart',
          label: 'Open Chart of Accounts',
          section: 'Navigate',
          hint: 'G C',
          icon: BookCheck,
          action: () => {
            navigate('/accounts/chart');
            onClose();
          },
        },
        {
          id: 'nav-ledger',
          label: 'Open Account Ledger',
          section: 'Navigate',
          hint: 'G L',
          icon: FileText,
          action: () => {
            navigate('/accounts/ledger');
            onClose();
          },
        },
        {
          id: 'nav-bs',
          label: 'Open Balance Sheet',
          section: 'Navigate',
          hint: 'Assets & Equity',
          icon: Scale,
          action: () => {
            navigate('/accounts/balance-sheet');
            onClose();
          },
        },
        {
          id: 'nav-pl',
          label: 'Open Profit & Loss Statement',
          section: 'Navigate',
          hint: 'G P',
          icon: TrendingUp,
          action: () => {
            navigate('/accounts/profit-loss');
            onClose();
          },
        },
        {
          id: 'nav-tb',
          label: 'Open Trial Balance',
          section: 'Navigate',
          hint: 'G T',
          icon: ListChecks,
          action: () => {
            navigate('/accounts/trial-balance');
            onClose();
          },
        }
      );
    }

    if (features.budgetAlerts) {
      list.push({
        id: 'nav-budgets',
        label: 'Go to Monthly Budgets',
        section: 'Navigate',
        hint: 'G B',
        icon: PiggyBank,
        action: () => {
          navigate('/budgets');
          onClose();
        },
      });
    }

    if (features.savingsGoals) {
      list.push({
        id: 'nav-goals',
        label: 'Go to Savings Goals',
        section: 'Navigate',
        hint: 'Milestones',
        icon: Target,
        action: () => {
          navigate('/goals');
          onClose();
        },
      });
    }

    list.push(
      {
        id: 'nav-categories',
        label: 'Go to Categories',
        section: 'Navigate',
        hint: 'Icons & Colors',
        icon: Layers,
        action: () => {
          navigate('/categories');
          onClose();
        },
      },
      {
        id: 'nav-settings',
        label: 'Go to Settings, Language & Password',
        section: 'Navigate',
        hint: 'G S',
        icon: Settings,
        action: () => {
          navigate('/settings');
          onClose();
        },
      },
      {
        id: 'nav-manual',
        label: 'Open User Manual & Guide',
        section: 'Navigate',
        hint: 'G M',
        icon: BookOpen,
        action: () => {
          navigate('/manual');
          onClose();
        },
      }
    );

    if (features.pdfReports) {
      list.push({
        id: 'act-pdf',
        label: 'Download Monthly PDF Financial Report',
        section: 'Quick Actions',
        hint: 'PDF',
        icon: FileDown,
        action: () => {
          void downloadMonthlyPdfReport(m, y, currency);
          onClose();
        },
      });
    }

    if (features.keyboardShortcuts && onOpenShortcuts) {
      list.push({
        id: 'act-shortcuts',
        label: 'View Keyboard Shortcuts Guide',
        section: 'Quick Actions',
        hint: '?',
        icon: Keyboard,
        action: () => {
          onClose();
          onOpenShortcuts();
        },
      });
    }

    list.push({
      id: 'act-theme',
      label: isDark ? 'Switch to Crisp Light Theme' : 'Switch to Obsidian Dark Theme',
      section: 'Quick Actions',
      hint: 'Theme',
      icon: isDark ? Sun : Moon,
      action: () => {
        toggleTheme();
        onClose();
      },
    });

    return list;
  }, [navigate, onClose, onOpenShortcuts, currency, isDark, toggleTheme, features]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.section.toLowerCase().includes(q) ||
        (i.hint && i.hint.toLowerCase().includes(q))
    );
  }, [items, query]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) =>
          filtered.length > 0 ? (prev + 1) % filtered.length : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) =>
          filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : 0
        );
      } else if (e.key === 'Enter' && filtered[activeIndex]) {
        e.preventDefault();
        filtered[activeIndex].action();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, filtered, activeIndex, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-4 bg-black/65 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-white/[0.08]">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command or jump to a page..."
                className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
              />
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-200 dark:border-white/10 rounded">
                ESC
              </kbd>
            </div>

            <div className="max-h-[340px] overflow-y-auto p-2 space-y-1">
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  No matching commands found.
                </p>
              ) : (
                filtered.map((item, idx) => {
                  const Icon = item.icon;
                  const active = idx === activeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={item.action}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-colors cursor-pointer ${
                        active
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="font-medium truncate">{item.label}</span>
                      </div>
                      {item.hint && (
                        <span
                          className={`text-[11px] font-mono shrink-0 ${
                            active ? 'text-indigo-100' : 'text-slate-400'
                          }`}
                        >
                          {item.hint}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
