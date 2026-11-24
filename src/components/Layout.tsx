import {
  AlertTriangle,
  ArrowLeftRight,
  Bell,
  BookCheck,
  BookOpen,
  CheckCircle2,
  Command,
  FileText,
  Keyboard,
  Landmark,
  Languages,
  Layers,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Moon,
  PiggyBank,
  Scale,
  Settings,
  Sun,
  Target,
  TrendingUp,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion, useScroll, useTransform } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { useTheme } from '../context/ThemeContext';
import { LANGUAGE_OPTIONS } from '../i18n/translations';
import type { LanguageCode, WorkspaceAlert } from '../types';
import { formatCurrency } from '../utils/formatCurrency';
import CommandPalette from './CommandPalette';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';

interface LayoutProps {
  title: string;
  subtitle?: string;
  headerAction?: ReactNode;
  children: ReactNode;
}

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export default function Layout({
  title,
  subtitle,
  headerAction,
  children,
}: LayoutProps) {
  const { user, currency, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { language, setLanguage, features, t } = usePreferences();
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Header Alerts Dropdown
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState<WorkspaceAlert[]>([]);
  const alertsRef = useRef<HTMLDivElement | null>(null);

  // Header Language Dropdown
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement | null>(null);

  const gChordActiveRef = useRef(false);
  const gChordTimerRef = useRef<number | null>(null);

  const { scrollY, scrollYProgress } = useScroll();
  const headerPaddingY = useTransform(scrollY, [0, 80], [0, 8]);
  const headerScale = useTransform(scrollY, [0, 80], [1, 0.992]);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await api.get<{ alerts: WorkspaceAlert[] }>('/analytics/alerts');
      setAlerts(res.data.alerts || []);
    } catch {
      // Keep UI quiet on transient polling error
    }
  }, []);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts, location.pathname]);

  // Filter alerts based on user's budgetAlerts / overdraftWarning customization toggles
  const visibleAlerts = useMemo(
    () =>
      alerts.filter((a) => {
        if (a.kind === 'OVERDRAFT') return features.overdraftWarning;
        if (a.kind === 'BUDGET') return features.budgetAlerts;
        if (a.kind === 'GOAL') return features.savingsGoals;
        return true;
      }),
    [alerts, features.budgetAlerts, features.overdraftWarning, features.savingsGoals]
  );

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) {
        setAlertsOpen(false);
      }
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
        return;
      }

      if (!features.keyboardShortcuts || isTypingTarget(e.target) || cmdOpen) {
        return;
      }

      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }

      const key = e.key.toLowerCase();
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (gChordActiveRef.current) {
          gChordActiveRef.current = false;
          if (gChordTimerRef.current) window.clearTimeout(gChordTimerRef.current);

          const routeMap: Record<string, string> = {
            d: '/dashboard',
            w: '/wallets',
            l: '/accounts/ledger',
            e: '/transactions',
            b: '/budgets',
            s: '/settings',
            m: '/manual',
            c: '/accounts/chart',
            p: '/accounts/profit-loss',
            t: '/accounts/trial-balance',
          };
          if (routeMap[key]) {
            e.preventDefault();
            navigate(routeMap[key]);
          }
          return;
        }

        if (key === 'g') {
          gChordActiveRef.current = true;
          if (gChordTimerRef.current) window.clearTimeout(gChordTimerRef.current);
          gChordTimerRef.current = window.setTimeout(() => {
            gChordActiveRef.current = false;
          }, 900);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (gChordTimerRef.current) window.clearTimeout(gChordTimerRef.current);
    };
  }, [features.keyboardShortcuts, cmdOpen, navigate]);

  const navGroups = useMemo<NavGroup[]>(() => {
    const accountsItems: NavItem[] = features.accountingModule
      ? [
          { to: '/accounts/chart', label: t('nav.chartOfAccounts'), icon: BookCheck },
          { to: '/accounts/ledger', label: t('nav.accountLedger'), icon: FileText },
          { to: '/wallets', label: t('nav.cashBank'), icon: Landmark },
          { to: '/transactions', label: t('nav.expensesEntries'), icon: ArrowLeftRight },
          { to: '/accounts/balance-sheet', label: t('nav.balanceSheet'), icon: Scale },
          { to: '/accounts/profit-loss', label: t('nav.profitLoss'), icon: TrendingUp },
          { to: '/accounts/trial-balance', label: t('nav.trialBalance'), icon: ListChecks },
        ]
      : [
          { to: '/wallets', label: t('nav.cashBank'), icon: Wallet },
          { to: '/transactions', label: t('nav.expensesEntries'), icon: ArrowLeftRight },
        ];

    const planningItems: NavItem[] = [
      ...(features.budgetAlerts
        ? [{ to: '/budgets', label: t('nav.budgets'), icon: PiggyBank }]
        : []),
      ...(features.savingsGoals
        ? [{ to: '/goals', label: t('nav.goals'), icon: Target }]
        : []),
      { to: '/categories', label: t('nav.categories'), icon: Layers },
    ];

    return [
      {
        title: t('nav.overview'),
        items: [{ to: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard }],
      },
      {
        title: t('nav.accounts'),
        items: accountsItems,
      },
      {
        title: t('nav.planning'),
        items: planningItems,
      },
      {
        title: t('nav.system'),
        items: [
          { to: '/settings', label: t('nav.settings'), icon: Settings },
          { to: '/manual', label: t('nav.userManual'), icon: BookOpen },
        ],
      },
    ];
  }, [features.accountingModule, features.budgetAlerts, features.savingsGoals, t]);

  const currentLangOption =
    LANGUAGE_OPTIONS.find((opt) => opt.code === language) || LANGUAGE_OPTIONS[0];

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'MW';

  const SidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-[#111114] border-r border-slate-200 dark:border-white/[0.08]">
      {/* Brand Logo */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200 dark:border-white/[0.08] shrink-0">
        <Link
          to="/dashboard"
          onClick={() => setSidebarOpen(false)}
          className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 shadow-lg shadow-blue-600/30 flex items-center justify-center text-white font-bold text-xs">
            MW
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            Multi-Wallet
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Grouped Accounting & Workspace Navigation */}
      <nav aria-label="Sidebar navigation" className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            <p className="px-3.5 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-zinc-500">
              {group.title}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `relative flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                      isActive
                        ? 'text-white'
                        : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId="sidebar-active-pill"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                          className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 shadow-lg shadow-indigo-600/25"
                        />
                      )}
                      <Icon className="relative z-10 w-4 h-4 shrink-0" aria-hidden="true" />
                      <span className="relative z-10 truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}

        {features.keyboardShortcuts && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                setShortcutsOpen(true);
              }}
              className="w-full flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-3 min-w-0">
                <Keyboard className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{t('nav.shortcuts')}</span>
              </span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-200 dark:border-white/[0.1] rounded">
                ?
              </kbd>
            </button>
          </div>
        )}
      </nav>

      {/* Bottom Profile & Logout */}
      <div className="p-4 border-t border-slate-200 dark:border-white/[0.08] space-y-3 shrink-0">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.1] flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {user?.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
              {user?.email}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200 dark:hover:bg-white/[0.1] border border-transparent dark:border-white/[0.06] rounded-xl transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t('header.signOut')}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-[#09090B] text-slate-900 dark:text-zinc-100 flex transition-colors duration-200">
      {/* Subtle Architectural Grain & Ambient Radial Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-grain-overlay z-0"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[900px] h-[360px] bg-indigo-500/10 dark:bg-indigo-500/[0.08] blur-[120px] rounded-full z-0"
      />

      {/* Scroll Progress Hairline */}
      <motion.div
        style={{ scaleX: scrollYProgress }}
        className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 origin-left z-50 pointer-events-none"
      />

      {/* Desktop Persistent Sidebar */}
      <aside className="relative z-20 hidden lg:block lg:w-[264px] lg:shrink-0 lg:sticky lg:top-0 lg:h-screen">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative w-[272px] max-w-[85vw] h-full z-10 shadow-2xl">
            {SidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="relative z-10 flex-1 min-w-0 flex flex-col pb-20 lg:pb-0">
        {/* Scroll-linked Floating Glass Dock Header */}
        <motion.div
          style={{ paddingTop: headerPaddingY, paddingLeft: headerPaddingY, paddingRight: headerPaddingY }}
          className="sticky top-0 z-30"
        >
          <motion.header
            style={{ scale: headerScale }}
            className="h-16 bg-white/85 dark:bg-[#111114]/85 backdrop-blur-xl border-b lg:border border-slate-200 dark:border-white/[0.08] lg:rounded-2xl lg:mx-4 lg:mt-2 px-4 sm:px-6 flex items-center justify-between gap-3 shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open navigation menu"
                className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white truncate">
                  {title}
                </h1>
                {subtitle && (
                  <p className="hidden sm:block text-xs text-slate-500 dark:text-zinc-400 truncate">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Command Palette Trigger */}
              <button
                type="button"
                onClick={() => setCmdOpen(true)}
                aria-label="Open command palette"
                className="hidden xl:inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl hover:border-indigo-500/60 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                <Command className="w-3.5 h-3.5" />
                <span>{t('header.quickJump')}</span>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] rounded">
                  ⌘K
                </kbd>
              </button>

              {/* Top Header Alerts Center */}
              <div ref={alertsRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAlertsOpen((prev) => !prev)}
                  aria-label="Workspace alerts"
                  aria-expanded={alertsOpen}
                  className="relative inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-zinc-200 hover:border-indigo-500 transition-colors cursor-pointer"
                >
                  <Bell className="w-4 h-4" />
                  {visibleAlerts.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold bg-rose-600 text-white leading-tight">
                      {visibleAlerts.length}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {alertsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }}
                      transition={{ duration: 0.14 }}
                      className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden z-50"
                    >
                      <div className="px-4 py-3 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {t('header.alerts')} ({visibleAlerts.length})
                        </span>
                        <Link
                          to="/settings"
                          onClick={() => setAlertsOpen(false)}
                          className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Configure
                        </Link>
                      </div>

                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.06]">
                        {visibleAlerts.length === 0 ? (
                          <div className="p-6 text-center space-y-2">
                            <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                            <p className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                              {t('header.noAlerts')}
                            </p>
                          </div>
                        ) : (
                          visibleAlerts.map((alert) => {
                            const isCritical = alert.severity === 'CRITICAL';
                            const isWarn = alert.severity === 'WARNING';
                            return (
                              <Link
                                key={alert.id}
                                to={alert.link}
                                onClick={() => setAlertsOpen(false)}
                                className="flex items-start gap-3 p-3.5 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
                              >
                                <div
                                  className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                                    isCritical
                                      ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                      : isWarn
                                        ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                        : 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                  }`}
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                                    {alert.title}
                                  </p>
                                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                                    {alert.message}
                                  </p>
                                  {typeof alert.amount === 'number' && (
                                    <p className="text-[11px] font-mono tabular-nums font-semibold text-slate-700 dark:text-zinc-300 mt-1">
                                      {formatCurrency(alert.amount, currency)}
                                    </p>
                                  )}
                                </div>
                              </Link>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Language Switcher Pill */}
              <div ref={langRef} className="relative">
                <button
                  type="button"
                  onClick={() => setLangOpen((prev) => !prev)}
                  aria-label="Switch language"
                  aria-expanded={langOpen}
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl hover:border-indigo-500 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Languages className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="hidden md:inline">{currentLangOption.nativeLabel}</span>
                </button>

                <AnimatePresence>
                  {langOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }}
                      transition={{ duration: 0.14 }}
                      className="absolute right-0 mt-2 w-44 bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.1] rounded-2xl shadow-xl p-1.5 z-50"
                    >
                      {LANGUAGE_OPTIONS.map((opt) => (
                        <button
                          key={opt.code}
                          type="button"
                          onClick={() => {
                            void setLanguage(opt.code as LanguageCode);
                            setLangOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl cursor-pointer transition-colors ${
                            language === opt.code
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                          }`}
                        >
                          <span>{opt.nativeLabel}</span>
                          <span className="text-[10px] opacity-75 uppercase">
                            {opt.code === 'roman_ur' ? 'UR-EN' : opt.code}
                          </span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Link
                to="/settings"
                title="Preferred currency"
                className="hidden sm:inline-flex items-center px-2.5 py-2 text-xs font-mono font-semibold text-slate-700 dark:text-zinc-200 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl hover:border-indigo-500 transition-colors"
              >
                {currency}
              </Link>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="p-2 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-zinc-200 hover:border-indigo-500 transition-colors cursor-pointer"
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-600" />
                )}
              </button>

              {headerAction}
            </div>
          </motion.header>
        </motion.div>

        {/* Main Viewport */}
        <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Quick Navigation Bar */}
      <nav
        aria-label="Mobile quick navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#111114]/95 backdrop-blur-xl border-t border-slate-200 dark:border-white/[0.08] px-2 py-1.5 flex items-center justify-around"
      >
        {[
          { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
          { to: '/wallets', label: 'Cash/Bank', icon: Wallet },
          { to: '/transactions', label: 'Entries', icon: ArrowLeftRight },
          { to: '/accounts/ledger', label: 'Ledger', icon: FileText },
          { to: '/settings', label: 'Settings', icon: Settings },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 dark:text-zinc-400'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <CommandPalette
        isOpen={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />
      <KeyboardShortcutsModal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}
