import { AreaChart, BadgeDelta, BarList, Card, Metric, ProgressBar } from '@tremor/react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileDown,
  Globe,
  LogIn,
  Mic,
  PiggyBank,
  PlayCircle,
  ShieldCheck,
  Target,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PREVIEW_CASHFLOW = [
  { Month: 'Jun', Income: 145000, Expense: 89000 },
  { Month: 'Jul', Income: 152000, Expense: 94000 },
  { Month: 'Aug', Income: 160000, Expense: 91500 },
  { Month: 'Sep', Income: 158000, Expense: 98000 },
  { Month: 'Oct', Income: 175000, Expense: 102000 },
  { Month: 'Nov', Income: 185000, Expense: 96400 },
];

const PREVIEW_WALLETS = [
  { name: 'Meezan Bank', value: 245000, color: 'blue' as const },
  { name: 'Cash Wallet', value: 42500, color: 'emerald' as const },
  { name: 'Visa Platinum', value: 38000, color: 'indigo' as const },
  { name: 'SadaPay Mobile', value: 29500, color: 'cyan' as const },
];

const NAV_LINKS = [
  { id: 'home', label: 'Home' },
  { id: 'features', label: 'Features' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'contact', label: 'Contact' },
];

export default function LandingPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState('home');
  const [demoLoading, setDemoLoading] = useState(false);

  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  useEffect(() => {
    const sections = NAV_LINKS.map((n) => document.getElementById(n.id)).filter(
      (el): el is HTMLElement => el !== null
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-35% 0px -55% 0px' }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleFreeDemo = async () => {
    if (isAuthenticated) {
      navigate('/dashboard');
      return;
    }
    setDemoLoading(true);
    try {
      await login('demo@example.com', 'password123');
      navigate('/dashboard');
    } catch {
      navigate('/register');
    } finally {
      setDemoLoading(false);
    }
  };

  const handleContactSubmit = (e: FormEvent) => {
    e.preventDefault();
    setContactError(null);
    if (contactName.trim().length < 2) {
      setContactError('Please enter your name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      setContactError('Please enter a valid email address.');
      return;
    }
    if (contactMessage.trim().length < 8) {
      setContactError('Please enter a short message (at least 8 characters).');
      return;
    }
    setContactSubmitted(true);
    setContactName('');
    setContactEmail('');
    setContactMessage('');
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col">
      {/* Crisp White Header — All Nav Links & Auth Actions Visible Directly */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200/90 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-8 py-2.5 md:py-0 md:h-[72px] flex flex-wrap md:flex-nowrap items-center justify-between gap-2 md:gap-4">
          {/* Brand Logo + Blue Wordmark */}
          <button
            type="button"
            onClick={() => scrollToSection('home')}
            className="flex items-center gap-2 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg"
          >
            <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-sm">
              <Wallet className="w-4 h-4 lg:w-5 lg:h-5" aria-hidden="true" />
            </div>
            <span className="text-base lg:text-xl font-extrabold tracking-tight text-blue-600 whitespace-nowrap">
              Multi-Wallet
            </span>
          </button>

          {/* Right Auth Actions: Login + Create Account + Free Demo */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 md:order-3">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 lg:py-2 text-xs lg:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-full shadow-sm shadow-blue-600/25 transition-colors whitespace-nowrap shrink-0"
              >
                <span>Open Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 px-3 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm font-semibold text-blue-600 border-[1.5px] border-blue-600 rounded-full hover:bg-blue-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Login</span>
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 px-3 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded-full hover:bg-slate-200 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                  <span>Create Account</span>
                </Link>
                <button
                  type="button"
                  onClick={() => void handleFreeDemo()}
                  disabled={demoLoading}
                  className="inline-flex items-center gap-1.5 px-3 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-full shadow-sm shadow-blue-600/30 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <PlayCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{demoLoading ? 'Opening...' : 'Free Demo'}</span>
                </button>
              </>
            )}
          </div>

          {/* Horizontal Navigation Links Displayed Directly in Header */}
          <nav
            aria-label="Primary navigation"
            className="w-full md:w-auto md:order-2 flex items-center justify-start md:justify-center gap-3.5 lg:gap-6 overflow-x-auto border-t border-slate-100 pt-2 md:border-t-0 md:pt-0"
          >
            {NAV_LINKS.map((link) => {
              const isActive = activeSection === link.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => scrollToSection(link.id)}
                  className={`relative py-1.5 md:py-2 text-xs lg:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'text-blue-600 font-semibold'
                      : 'text-slate-700 hover:text-blue-600'
                  }`}
                >
                  <span>{link.label}</span>
                  {isActive && (
                    <span className="absolute left-0 right-0 bottom-0 h-[2.5px] rounded-full bg-blue-600" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Page Body */}
      <main className="dark flex-1">
        {/* Hero Section */}
        <section
          id="home"
          className="relative overflow-hidden bg-gradient-to-b from-[#0B1120] via-[#09090B] to-[#09090B] border-b border-white/[0.08]"
        >
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[900px] h-[420px] bg-blue-600/15 blur-[130px] rounded-full" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.12] [text-wrap:balance]">
                Track every wallet, budget limit, and cashflow trend in one place.
              </h1>
              <p className="text-base sm:text-lg text-zinc-400 leading-relaxed max-w-xl">
                Multi-Wallet brings Cash, Bank, Card, and Mobile Wallets together with real-time net worth calculation, voice-to-text logging, threshold budget alerts, savings goals, and monthly PDF financial reports.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => void handleFreeDemo()}
                  disabled={demoLoading}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-full shadow-lg shadow-blue-600/30 transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>{demoLoading ? 'Launching Workspace...' : 'Explore Live Workspace'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-zinc-200 border border-white/15 hover:border-white/35 rounded-full transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Create Free Account</span>
                </Link>
              </div>

              <div className="pt-4 border-t border-white/[0.08] flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-400">
                <span>Cash, Bank, Card &amp; Mobile Wallets</span>
                <span aria-hidden="true">·</span>
                <span>PKR, USD, EUR &amp; GBP Support</span>
                <span aria-hidden="true">·</span>
                <span>Instant PDF &amp; CSV Export</span>
              </div>
            </div>

            {/* Live Tremor Dashboard Preview Panel */}
            <div className="lg:col-span-6">
              <Card className="bg-[#111114] ring-1 ring-white/[0.08] p-6 space-y-5 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-zinc-400">
                      Combined Multi-Wallet Net Worth
                    </p>
                    <Metric className="font-mono tabular-nums text-white mt-1">
                      PKR 355,000
                    </Metric>
                  </div>
                  <BadgeDelta deltaType="moderateIncrease" isIncreasePositive={true}>
                    +14.2% MoM
                  </BadgeDelta>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-medium text-zinc-400 mb-2.5">
                    <span>Wallet Distribution</span>
                    <span className="font-mono tabular-nums text-zinc-400">
                      4 accounts
                    </span>
                  </div>
                  <BarList
                    data={PREVIEW_WALLETS}
                    valueFormatter={(v: number) => `PKR ${v.toLocaleString()}`}
                    showAnimation={true}
                  />
                </div>

                <div className="pt-3 border-t border-white/[0.08] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-medium">
                      Monthly Budget Utilization
                    </span>
                    <span className="font-mono tabular-nums text-emerald-400">
                      68.4% used
                    </span>
                  </div>
                  <ProgressBar value={68.4} color="emerald" />
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* 01. Core Capabilities (Asymmetric Bento Layout) */}
        <section
          id="features"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 space-y-10"
        >
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold tracking-wider text-blue-400 uppercase">
              01. Platform Capabilities
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white [text-wrap:balance]">
              Built for complete personal &amp; household financial clarity.
            </h2>
            <p className="text-sm sm:text-base text-zinc-400">
              Every transaction updates wallet balances, category budget thresholds, and monthly trend analytics atomically with exact two-decimal precision.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            <Card className="md:col-span-7 bg-[#111114] ring-1 ring-white/[0.08] p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  Unified Multi-Wallet &amp; Instant Transfers
                </h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Separate your balances across Cash, Bank Accounts, Credit/Debit Cards, and Mobile Wallets. Log internal transfers between any two accounts without inflating income or expense totals.
              </p>
            </Card>

            <Card className="md:col-span-5 bg-[#111114] ring-1 ring-white/[0.08] p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                  <Mic className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  Voice-to-Text Quick Logging
                </h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Dictate expenses or income directly from the Dashboard microphone using the Web Speech API—automatically extracting amount, category, wallet, and date.
              </p>
            </Card>

            <Card className="md:col-span-4 bg-[#111114] ring-1 ring-white/[0.08] p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                  <PiggyBank className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  80% &amp; 100% Budget Alerts
                </h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Assign monthly spending caps per expense category and track live Tremor progress bars with automatic warning and over-budget states.
              </p>
            </Card>

            <Card className="md:col-span-4 bg-[#111114] ring-1 ring-white/[0.08] p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
                  <Target className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  Savings Goals &amp; Milestones
                </h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Set target amounts and deadlines for emergency funds or purchases, and fund goals directly from any connected wallet.
              </p>
            </Card>

            <Card className="md:col-span-4 bg-[#111114] ring-1 ring-white/[0.08] p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
                  <FileDown className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  Monthly PDF &amp; Bulk CSV
                </h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Download formatted monthly A4 PDF financial statements summarizing cashflow, categories, budgets, and transactions, plus bulk CSV import/export.
              </p>
            </Card>
          </div>
        </section>

        {/* 02. How It Works */}
        <section
          id="how-it-works"
          className="border-y border-white/[0.08] bg-[#111114]/60"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 space-y-10">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-semibold tracking-wider text-blue-400 uppercase">
                02. Workflow Architecture
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white [text-wrap:balance]">
                From wallet setup to monthly statement in three steps.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  step: '01',
                  title: 'Provision Your Wallets',
                  desc: 'Sign up with automatic starter Cash & Bank accounts and 8 categories, or customize cards, mobile wallets, and preferred currency (PKR, USD, EUR, GBP).',
                },
                {
                  step: '02',
                  title: 'Capture Every Entry',
                  desc: 'Log income, expenses, recurring bills, or wallet transfers using the quick-add microphone, slide-over drawer, or bulk CSV upload.',
                },
                {
                  step: '03',
                  title: 'Analyze & Export Reports',
                  desc: 'Inspect Tremor cashflow charts, stay ahead of category budget thresholds, and export monthly PDF financial statements anytime.',
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="p-6 rounded-2xl bg-[#09090B] border border-white/[0.08] space-y-3"
                >
                  <span className="font-mono text-sm font-bold text-blue-400">
                    {item.step}.
                  </span>
                  <h3 className="text-lg font-bold text-white">{item.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 03. Interactive Tremor Analytics Showcase */}
        <section
          id="analytics"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center"
        >
          <div className="lg:col-span-5 space-y-5">
            <p className="text-xs font-semibold tracking-wider text-blue-400 uppercase">
              03. Precision Analytics
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white [text-wrap:balance]">
              Zero-drift ledger math paired with Tremor visualizations.
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
              Every sum, percentage change, savings rate, and wallet mutation is computed in integer cents on the server so reports reconcile down to the last decimal.
            </p>

            <ul className="space-y-3 text-sm text-zinc-300">
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Atomic database transactions for edits, deletes &amp; transfers</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-blue-400 shrink-0" />
                <span>UTC-normalized dates with tabular monospace alignment</span>
              </li>
              <li className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>JWT authentication with bcryptjs password hashing</span>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-7">
            <Card className="bg-[#111114] ring-1 ring-white/[0.08] p-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    <span>6-Month Income vs Expense Flow</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Powered by @tremor/react AreaChart
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-emerald-400">
                  +47.9% Avg Savings
                </span>
              </div>

              <AreaChart
                className="h-64"
                data={PREVIEW_CASHFLOW}
                index="Month"
                categories={['Income', 'Expense']}
                colors={['emerald', 'rose']}
                valueFormatter={(v: number) => `PKR ${(v / 1000).toFixed(0)}k`}
                yAxisWidth={64}
                showAnimation={true}
              />
            </Card>
          </div>
        </section>

        {/* 04. Contact & Inquiry Form */}
        <section
          id="contact"
          className="border-t border-white/[0.08] bg-[#111114]/60"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5 space-y-3">
              <p className="text-xs font-semibold tracking-wider text-blue-400 uppercase">
                04. Get In Touch
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-white [text-wrap:balance]">
                Questions about Multi-Wallet or custom workflows?
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Send a note directly or jump straight into the live workspace using the Free Demo button in the header.
              </p>
            </div>

            <div className="lg:col-span-7">
              <Card className="bg-[#111114] ring-1 ring-white/[0.08] p-6 sm:p-8">
                {contactSubmitted ? (
                  <div className="py-6 text-center space-y-3">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                    <h3 className="text-lg font-bold text-white">
                      Message received
                    </h3>
                    <p className="text-sm text-zinc-400">
                      Thank you for reaching out. Our team will respond shortly.
                    </p>
                    <button
                      type="button"
                      onClick={() => setContactSubmitted(false)}
                      className="px-4 py-2 text-xs font-semibold text-blue-400 hover:underline cursor-pointer"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    {contactError && (
                      <div
                        role="alert"
                        className="px-3.5 py-2.5 text-sm text-rose-300 bg-rose-950/50 border border-rose-800 rounded-xl"
                      >
                        {contactError}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="contact-name"
                          className="block text-xs font-medium text-zinc-300 mb-1.5"
                        >
                          Your Name
                        </label>
                        <input
                          id="contact-name"
                          type="text"
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="Full name"
                          required
                          className="w-full px-3.5 py-2.5 text-sm text-white bg-[#09090B] border border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="contact-email"
                          className="block text-xs font-medium text-zinc-300 mb-1.5"
                        >
                          Email Address
                        </label>
                        <input
                          id="contact-email"
                          type="email"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="you@domain.com"
                          required
                          className="w-full px-3.5 py-2.5 text-sm text-white bg-[#09090B] border border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor="contact-message"
                        className="block text-xs font-medium text-zinc-300 mb-1.5"
                      >
                        Message
                      </label>
                      <textarea
                        id="contact-message"
                        rows={4}
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        placeholder="Tell us about your budget tracking or multi-wallet needs..."
                        required
                        className="w-full px-3.5 py-2.5 text-sm text-white bg-[#09090B] border border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-full transition-colors cursor-pointer"
                      >
                        <span>Send Message</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                )}
              </Card>
            </div>
          </div>
        </section>
      </main>

      {/* Structured Footer */}
      <footer className="dark bg-[#09090B] border-t border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-white/[0.08]">
            <div className="md:col-span-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white">
                  <Wallet className="w-4 h-4" />
                </div>
                <span className="text-lg font-extrabold text-white tracking-tight">
                  Multi-Wallet
                </span>
              </div>
              <p className="text-sm text-zinc-400 max-w-sm leading-relaxed">
                Personal expense, budget, savings goal, and multi-account finance tracker built with integer-cent accuracy and real-time analytics.
              </p>
            </div>

            <div className="md:col-span-2 space-y-2.5">
              <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                Navigation
              </h3>
              <ul className="space-y-2 text-sm text-zinc-400">
                {NAV_LINKS.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => scrollToSection(l.id)}
                      className="hover:text-white transition-colors cursor-pointer"
                    >
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="md:col-span-3 space-y-2.5">
              <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                Workspace Modules
              </h3>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li>Cash, Bank, Card &amp; Mobile Wallets</li>
                <li>Voice-to-Text Quick Logging</li>
                <li>Category Budgets &amp; Savings Goals</li>
                <li>Monthly PDF Reports &amp; CSV Sync</li>
              </ul>
            </div>

            <div className="md:col-span-2 space-y-2.5">
              <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                Account
              </h3>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li>
                  <Link to="/login" className="hover:text-white transition-colors">
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="hover:text-white transition-colors">
                    Create Account
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => void handleFreeDemo()}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Free Demo
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
            <p>© {new Date().getFullYear()} Multi-Wallet. All rights reserved.</p>
            <p>Multi-Currency Ledger · Integer-Cent Precision</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
