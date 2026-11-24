export type CurrencyCode = 'PKR' | 'USD' | 'EUR' | 'GBP';
export type LanguageCode = 'en' | 'roman_ur' | 'ur' | 'es';
export type AccountType = 'CASH' | 'BANK' | 'CARD' | 'MOBILE_WALLET';
export type CategoryType = 'INCOME' | 'EXPENSE';
export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';
export type RecurringInterval = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface FeaturePreferences {
  voiceQuickAdd: boolean;
  budgetAlerts: boolean;
  savingsGoals: boolean;
  accountingModule: boolean;
  pdfReports: boolean;
  overdraftWarning: boolean;
  keyboardShortcuts: boolean;
}

export interface User {
  id: number;
  name: string;
  email: string;
  currency: CurrencyCode;
  language?: LanguageCode;
  featurePreferences?: FeaturePreferences;
  monthlyIncomeGoal: number;
  emailVerified?: boolean;
  createdAt: string;
}

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  balance: number;
  color: string;
  userId: number;
  createdAt: string;
  _count?: {
    transactions: number;
    incomingTransfers: number;
  };
}

export interface Category {
  id: number;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  userId: number;
  _count?: {
    transactions: number;
    budgets: number;
  };
}

export interface Transaction {
  id: number;
  title: string;
  amount: number;
  type: TransactionType;
  date: string;
  notes: string | null;
  isRecurring: boolean;
  recurringInterval: RecurringInterval | null;
  categoryId: number | null;
  category: Category | null;
  accountId: number;
  account: Account;
  toAccountId: number | null;
  toAccount: Account | null;
  userId: number;
  createdAt: string;
}

export interface BudgetItem {
  id: number;
  amount: number;
  month: number;
  year: number;
  categoryId: number;
  category: Category;
  spent: number;
  remaining: number;
  percentage: number;
  status: 'OK' | 'WARNING' | 'EXCEEDED';
}

export interface SavingsGoal {
  id: number;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  color: string;
  userId: number;
  createdAt: string;
}

export interface CategoryBreakdownItem {
  categoryId: number;
  name: string;
  color: string;
  total: number;
  count: number;
  percentage: number;
}

export interface MonthlyTrendItem {
  key: string;
  label: string;
  income: number;
  expense: number;
  net: number;
}

export interface DailySpendingPoint {
  day: number;
  label: string;
  expense: number;
  cumulative: number;
}

export interface BudgetAlertItem {
  id: number;
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  limit: number;
  spent: number;
  remaining: number;
  percentage: number;
  status: 'OK' | 'WARNING' | 'EXCEEDED';
}

export interface WorkspaceAlert {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  kind: 'OVERDRAFT' | 'BUDGET' | 'GOAL';
  title: string;
  message: string;
  link: string;
  amount?: number;
  accountName?: string;
}

export interface AnalyticsResponse {
  month: number;
  year: number;
  kpis: {
    totalNetWorth: number;
    monthlyIncome: number;
    monthlyExpense: number;
    savingsRate: number;
    incomeDeltaPct: number | null;
    expenseDeltaPct: number | null;
    netCashflow: number;
    prevNetCashflow: number;
  };
  sparklines: {
    income: number[];
    expense: number[];
    net: number[];
  };
  categoryBreakdown: CategoryBreakdownItem[];
  monthlyTrend: MonthlyTrendItem[];
  dailySpendingCurve: DailySpendingPoint[];
  budgetAlerts: BudgetAlertItem[];
  goals: SavingsGoal[];
  recentTransactions: Transaction[];
}

export interface MonthlyReportResponse {
  generatedAt: string;
  month: number;
  year: number;
  user: {
    name: string;
    email: string;
    currency: CurrencyCode;
    monthlyIncomeGoal: number;
  };
  summary: {
    totalNetWorth: number;
    totalIncome: number;
    totalExpense: number;
    totalTransfers: number;
    netSavings: number;
    savingsRate: number;
    transactionCount: number;
  };
  accounts: Account[];
  categoryBreakdown: Array<{
    name: string;
    color: string;
    total: number;
    count: number;
    percentage: number;
  }>;
  budgetSummary: Array<{
    categoryName: string;
    limit: number;
    spent: number;
    remaining: number;
    percentage: number;
    status: string;
  }>;
  goals: SavingsGoal[];
  transactions: Transaction[];
}

export interface AccountLedgerEntry {
  id: number;
  date: string;
  createdAt: string;
  title: string;
  type: TransactionType;
  notes: string | null;
  categoryName: string;
  counterparty: string;
  inflow: number;
  outflow: number;
  runningBalance: number;
}

export interface AccountLedgerResponse {
  account: Account;
  openingBalance: number;
  closingBalance: number;
  totalInflow: number;
  totalOutflow: number;
  entries: AccountLedgerEntry[];
}

export interface AccountingStatementsResponse {
  scope: 'month' | 'all';
  month: number;
  year: number;
  chartOfAccounts: {
    assets: Array<{
      id: number;
      code: string;
      name: string;
      type: AccountType;
      color: string;
      balance: number;
      txCount: number;
    }>;
    liabilities: Array<{
      id: number;
      code: string;
      name: string;
      type: AccountType;
      color: string;
      balance: number;
      txCount: number;
    }>;
    incomeCategories: Array<{
      id: number;
      code: string;
      name: string;
      color: string;
      periodTotal: number;
      allTimeTotal: number;
      txCount: number;
    }>;
    expenseCategories: Array<{
      id: number;
      code: string;
      name: string;
      color: string;
      periodTotal: number;
      allTimeTotal: number;
      txCount: number;
    }>;
  };
  balanceSheet: {
    assets: Array<{
      id: number;
      code: string;
      name: string;
      type: AccountType;
      color: string;
      balance: number;
      txCount: number;
    }>;
    liabilities: Array<{
      id: number;
      code: string;
      name: string;
      type: AccountType;
      color: string;
      balance: number;
      txCount: number;
    }>;
    totalAssets: number;
    totalLiabilities: number;
    openingCapital: number;
    retainedEarnings: number;
    totalEquity: number;
    totalLiabilitiesAndEquity: number;
    isBalanced: boolean;
  };
  profitAndLoss: {
    incomeItems: Array<{
      id: number;
      code: string;
      name: string;
      color: string;
      periodTotal: number;
      allTimeTotal: number;
      txCount: number;
    }>;
    expenseItems: Array<{
      id: number;
      code: string;
      name: string;
      color: string;
      periodTotal: number;
      allTimeTotal: number;
      txCount: number;
    }>;
    totalIncome: number;
    totalExpense: number;
    netProfit: number;
    savingsRate: number;
  };
  trialBalance: {
    rows: Array<{
      code: string;
      accountName: string;
      group: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
      debit: number;
      credit: number;
    }>;
    totalDebits: number;
    totalCredits: number;
    difference: number;
    isBalanced: boolean;
  };
}
