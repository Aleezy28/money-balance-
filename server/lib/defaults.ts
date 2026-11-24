import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.ts';

export interface DefaultAccountSeed {
  name: string;
  type: 'CASH' | 'BANK' | 'CARD' | 'MOBILE_WALLET';
  balance: number;
  color: string;
}

export interface DefaultCategorySeed {
  name: string;
  type: 'INCOME' | 'EXPENSE';
  color: string;
  icon: string;
}

export const DEFAULT_ACCOUNTS: DefaultAccountSeed[] = [
  { name: 'Cash', type: 'CASH', balance: 0, color: '#059669' },
  { name: 'Bank Account', type: 'BANK', balance: 0, color: '#2563EB' },
];

export const DEFAULT_CATEGORIES: DefaultCategorySeed[] = [
  { name: 'Salary', type: 'INCOME', color: '#059669', icon: 'Briefcase' },
  { name: 'Freelance', type: 'INCOME', color: '#0D9488', icon: 'Laptop' },
  { name: 'Food & Dining', type: 'EXPENSE', color: '#D97706', icon: 'Utensils' },
  { name: 'Rent & Housing', type: 'EXPENSE', color: '#2563EB', icon: 'Home' },
  { name: 'Transport', type: 'EXPENSE', color: '#4F46E5', icon: 'Car' },
  { name: 'Shopping', type: 'EXPENSE', color: '#DB2777', icon: 'ShoppingBag' },
  { name: 'Bills & Utilities', type: 'EXPENSE', color: '#DC2626', icon: 'Zap' },
  { name: 'Healthcare', type: 'EXPENSE', color: '#7C3AED', icon: 'HeartPulse' },
];

export async function seedDefaultUserEntities(
  tx: Prisma.TransactionClient,
  userId: number
): Promise<void> {
  await tx.account.createMany({
    data: DEFAULT_ACCOUNTS.map((acc) => ({
      name: acc.name,
      type: acc.type,
      balance: acc.balance,
      color: acc.color,
      userId,
    })),
  });

  await tx.category.createMany({
    data: DEFAULT_CATEGORIES.map((cat) => ({
      name: cat.name,
      type: cat.type,
      color: cat.color,
      icon: cat.icon,
      userId,
    })),
  });
}

function monthDayNoonUtc(monthsAgo: number, day: number): Date {
  const now = new Date();
  const targetMonth = now.getUTCMonth() - monthsAgo;
  const maxDayInMonth = new Date(
    Date.UTC(now.getUTCFullYear(), targetMonth + 1, 0)
  ).getUTCDate();
  const safeDay = Math.min(day, maxDayInMonth);
  return new Date(Date.UTC(now.getUTCFullYear(), targetMonth, safeDay, 12, 0, 0, 0));
}

function futureMonthsNoonUtc(monthsAhead: number): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthsAhead, 15, 12, 0, 0, 0)
  );
}

export async function seedDemoAccount(forceReset = false): Promise<void> {
  const demoEmail = 'demo@example.com';

  const existing = await prisma.user.findUnique({
    where: { email: demoEmail },
  });

  if (existing && !forceReset) {
    return;
  }

  if (existing && forceReset) {
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const hashedPassword = await bcrypt.hash('password123', 10);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: 'Alex Morgan',
        email: demoEmail,
        password: hashedPassword,
        currency: 'PKR',
        monthlyIncomeGoal: 240000,
        emailVerified: true,
      },
    });

    // 3 wallets: Cash, Bank, Credit Card
    const cashWallet = await tx.account.create({
      data: {
        name: 'Cash Wallet',
        type: 'CASH',
        balance: 18500,
        color: '#059669',
        userId: user.id,
      },
    });

    const bankWallet = await tx.account.create({
      data: {
        name: 'Meezan Bank',
        type: 'BANK',
        balance: 312000,
        color: '#2563EB',
        userId: user.id,
      },
    });

    const cardWallet = await tx.account.create({
      data: {
        name: 'Visa Platinum Card',
        type: 'CARD',
        balance: 64500,
        color: '#4F46E5',
        userId: user.id,
      },
    });

    // 8 default categories
    await tx.category.createMany({
      data: DEFAULT_CATEGORIES.map((cat) => ({
        name: cat.name,
        type: cat.type,
        color: cat.color,
        icon: cat.icon,
        userId: user.id,
      })),
    });

    const categories = await tx.category.findMany({ where: { userId: user.id } });
    const catId = (name: string): number => {
      const found = categories.find((c) => c.name === name);
      if (!found) throw new Error(`Missing category ${name}`);
      return found.id;
    };

    // 35 realistic transactions across the last 3 months
    const sampleTransactions: Array<{
      title: string;
      amount: number;
      type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
      date: Date;
      notes: string;
      isRecurring: boolean;
      recurringInterval: string | null;
      categoryId: number | null;
      accountId: number;
      toAccountId: number | null;
    }> = [
      // Current Month (monthsAgo = 0) — 13 transactions
      {
        title: 'Monthly Engineering Salary',
        amount: 185000,
        type: 'INCOME',
        date: monthDayNoonUtc(0, 1),
        notes: 'Primary payroll deposit',
        isRecurring: true,
        recurringInterval: 'MONTHLY',
        categoryId: catId('Salary'),
        accountId: bankWallet.id,
        toAccountId: null,
      },
      {
        title: 'Design System Consulting',
        amount: 42000,
        type: 'INCOME',
        date: monthDayNoonUtc(0, 7),
        notes: 'UI architecture milestone payout',
        isRecurring: false,
        recurringInterval: null,
        categoryId: catId('Freelance'),
        accountId: bankWallet.id,
        toAccountId: null,
      },
      {
        title: 'Apartment Monthly Rent',
        amount: 55000,
        type: 'EXPENSE',
        date: monthDayNoonUtc(0, 2),
        notes: 'Monthly lease transfer',
        isRecurring: true,
        recurringInterval: 'MONTHLY',
        categoryId: catId('Rent & Housing'),
        accountId: bankWallet.id,
        toAccountId: null,
      },
      {
        title: 'ATM Cash Withdrawal',
        amount: 20000,
        type: 'TRANSFER',
        date: monthDayNoonUtc(0, 3),
        notes: 'Replenish cash pocket wallet',
        isRecurring: false,
        recurringInterval: null,
        categoryId: null,
        accountId: bankWallet.id,
        toAccountId: cashWallet.id,
      },
      {
        title: 'Supermarket Weekly Groceries',
        amount: 14200,
        type: 'EXPENSE',
        date: monthDayNoonUtc(0, 4),
        notes: 'Produce, dairy, pantry staples',
        isRecurring: false,
        recurringInterval: null,
        categoryId: catId('Food & Dining'),
        accountId: cardWallet.id,
        toAccountId: null,
      },
      {
        title: 'Fiber Internet & Mobile Plan',
        amount: 6800,
        type: 'EXPENSE',
        date: monthDayNoonUtc(0, 5),
        notes: 'Monthly telecom utilities',
        isRecurring: true,
        recurringInterval: 'MONTHLY',
        categoryId: catId('Bills & Utilities'),
        accountId: bankWallet.id,
        toAccountId: null,
      },
      {
        title: 'Electricity Bill (LESCO)',
        amount: 14600,
        type: 'EXPENSE',
        date: monthDayNoonUtc(0, 8),
        notes: 'Monthly power invoice',
        isRecurring: true,
        recurringInterval: 'MONTHLY',
        categoryId: catId('Bills & Utilities'),
        accountId: bankWallet.id,
        toAccountId: null,
      },
      {
        title: 'Fuel & Highway Toll',
        amount: 8500,
        type: 'EXPENSE',
        date: monthDayNoonUtc(0, 9),
        notes: 'Full tank refill',
        isRecurring: false,
        recurringInterval: null,
        categoryId: catId('Transport'),
        accountId: cashWallet.id,
        toAccountId: null,
      },
      {
        title: 'Weekend Bistro & Coffee',
        amount: 6400,
        type: 'EXPENSE',
        date: monthDayNoonUtc(0, 11),
        notes: 'Dinner with colleagues',
        isRecurring: false,
        recurringInterval: null,
        categoryId: catId('Food & Dining'),
        accountId: cardWallet.id,
        toAccountId: null,
      },
      {
        title: 'Mechanical Keyboard & Desk Mat',
        amount: 16500,
        type: 'EXPENSE',
        date: monthDayNoonUtc(0, 13),
        notes: 'Home office ergonomics',
        isRecurring: false,
        recurringInterval: null,
        categoryId: catId('Shopping'),
        accountId: cardWallet.id,
        toAccountId: null,
      },
      {
        title: 'Pharmacy & Dental Checkup',
        amount: 5200,
        type: 'EXPENSE',
        date: monthDayNoonUtc(0, 15),
        notes: 'Routine wellness check',
        isRecurring: false,
        recurringInterval: null,
        categoryId: catId('Healthcare'),
        accountId: cashWallet.id,
        toAccountId: null,
      },
      {
        title: 'Fresh Market Produce Run',
        amount: 6900,
        type: 'EXPENSE',
        date: monthDayNoonUtc(0, 17),
        notes: 'Fruits, bakery, coffee beans',
        isRecurring: false,
        recurringInterval: null,
        categoryId: catId('Food & Dining'),
        accountId: cashWallet.id,
        toAccountId: null,
      },
      {
        title: 'Ride-share Commutes',
        amount: 4100,
        type: 'EXPENSE',
        date: monthDayNoonUtc(0, 19),
        notes: 'Airport & client office rides',
        isRecurring: false,
        recurringInterval: null,
        categoryId: catId('Transport'),
        accountId: cardWallet.id,
        toAccountId: null,
      },

      // Last Month (monthsAgo = 1) — 12 transactions
      {
        title: 'Monthly Engineering Salary',
        amount: 185000,
        type: 'INCOME',
        date: monthDayNoonUtc(1, 1),
        notes: 'Primary payroll deposit',
        isRecurring: true,
        recurringInterval: 'MONTHLY',
        categoryId: catId('Salary'),
        accountId: bankWallet.id,
        toAccountId: null,
      },
      {
        title: 'API Integration Freelance',
        amount: 28000,
        type: 'INCOME',
        date: monthDayNoonUtc(1, 12),
        notes: 'Backend webhook project',
        isRecurring: false,
        recurringInterval: null,
        categoryId: catId('Freelance'),
        accountId: bankWallet.id,
        toAccountId: null,
      },
      {
        title: 'Apartment Monthly Rent',
        amount: 55000,
        type: 'EXPENSE',
        date: monthDayNoonUtc(1, 2),
        notes: 'Monthly lease transfer',
        isRecurring: true,
        recurringInterval: 'MONTHLY',
        categoryId: catId('Rent & Housing'),
        accountId: bankWallet.id,
        toAccountId: null,
      },
      {
        title: 'Card Balance Settlement',
        amount: 35000,
        type: 'TRANSFER',
        date: monthDayNoonUtc(1, 5),
        notes: 'Monthly credit card top-up',
        isRecurring: false,
        recurringInterval: null,
        categoryId: null,
        accountId: bankWallet.id,
        toAccountId: cardWallet.id,
      },
      {
        title: 'Monthly Bulk Groceries',
        amount: 18400,
        type: 'EXPENSE',
        date: monthDayNoonUtc(1, 6),
        notes: 'Hypermarket household restock',
        isRecurring: false,
        recurringInterval: null,
        categoryId: catId('Food & Dining'),
        accountId: cardWallet.id,
        toAccountId: null,
      },
      {
        title: 'Electricity & Gas Bills',
        amount: 17900,
        type: 'EXPENSE',
        date: monthDayNoonUtc(1, 8),
        notes: 'Monthly home utilities',
        isRecurring: true,
        recurringInterval: 'MONTHLY',
        categoryId: catId('Bills & Utilities'),
        accountId: bankWallet.id,
        toAccountId: null,
      },
      {
        title: 'Fuel & Car Service',
        amount: 12800,
        type: 'EXPENSE',
        date: monthDayNoonUtc(1, 11),
        notes: 'Oil change and tank refill',
        isRecurring: false,
        recurringInterval: null,
        categoryId: catId('Transport'),
        accountId: cashWallet.id,
        toAccountId: null,
      },
      {
        title: 'Running Shoes & Apparel',
        amount: 19500,
        type: 'EXPENSE',
        date: monthDayNoonUtc(1, 15),
        notes: 'Seasonal athletic gear',
        isRecurring: false,
        recurringInterval: null,
        categoryId: catId('Shopping'),
        accountId: cardWallet.id,
        toAccountId: null,
      },
      {
        title: 'Family Dinner Out',
        amount: 9200,
        type: 'EXPENSE',
        date: monthDayNoonUtc(1, 18),
        notes: 'Weekend dinner celebration',
        isRecurring: false,
        recurringInterval: null,
        categoryId: catId('Food & Dining'),
        accountId: cardWallet.id,
        toAccountId: null,
      },
      {
        title: 'Optical & Vitamins',
        amount: 4600,
        type: 'EXPENSE',
        date: monthDayNoonUtc(1, 21),
        notes: 'Wellness supplements',
        isRecurring: false,
        recurringInterval: null,
        categoryId: catId('Healthcare'),
        accountId: cashWallet.id,
        toAccountId: null,
      },
      {
        title: 'Fiber Internet Plan',
        amount: 4500,
        type: 'EXPENSE',
        date: monthDayNoonUtc(1, 24),
        notes: 'Home broadband',
        isRecurring: true,
        recurringInterval: 'MONTHLY',
        categoryId: catId('Bills & Utilities'),
        accountId: bankWallet.id,
        toAccountId: null,
      },
      {
        title: 'Coffee & Bakery Stops',
        amount: 3700,
        type: 'EXPENSE',
        date: monthDayNoonUtc(1, 27),
        notes: 'Daily espresso & snacks',
        isRecurring: false,
        recurringInterval: null,
        categoryId: catId('Food & Dining'),
        accountId: cashWallet.id,
        toAccountId: null,
      },

      // Two Months Ago (monthsAgo = 2) — 10 transactions
      {
        title: 'Monthly Engineering Salary',
        amount: 175000,
        type: 'INCOME',
        date: monthDayNoonUtc(2, 1),
        notes: 'Primary payroll deposit',
        isRecurring: true,
        recurringInterval: 'MONTHLY',
        categoryId: catId('Salary'),
        accountId: bankWallet.id,
        toAccountId: null,
      },
      {
        title: 'UI Audit Side Project',
        amount: 22000,
        type: 'INCOME',
        date: monthDayNoonUtc(2, 14),
        notes: 'Product UX review',
        isRecurring: false,
        recurringInterval: null,
        categoryId: catId('Freelance'),
        accountId: bankWallet.id,
        toAccountId: null,
      },
      {
        title: 'Apartment Monthly Rent',
        amount: 55000,
        type: 'EXPENSE',
        date: monthDayNoonUtc(2, 2),
        notes: 'Monthly lease transfer',
        isRecurring: true,
        recurringInterval: 'MONTHLY',
        categoryId: catId('Rent & Housing'),
        accountId: bankWallet.id,
        toAccountId: null,
      },
      {
        title: 'Monthly Groceries & Pantry',
        amount: 16800,
        type: 'EXPENSE',
        date: monthDayNoonUtc(2, 7),
        notes: 'Supermarket haul',
        isRecurring: false,
        recurringInterval: null,
        categoryId: catId('Food & Dining'),
        accountId: cardWallet.id,
        toAccountId: null,
      },
      {
        title: 'Utilities & Water',
        amount: 15400,
        type: 'EXPENSE',
        date: monthDayNoonUtc(2, 9),
        notes: 'Monthly power & water',
        isRecurring: true,
        recurringInterval: 'MONTHLY',
        categoryId: catId('Bills & Utilities'),
        accountId: bankWallet.id,
        toAccountId: null,
      },
      {
        title: 'Fuel & Commute',
        amount: 9200,
        type: 'EXPENSE',
        date: monthDayNoonUtc(2, 12),
        notes: 'Fuel & metro card',
        isRecurring: false,
        recurringInterval: null,
        categoryId: catId('Transport'),
        accountId: cashWallet.id,
        toAccountId: null,
      },
      {
        title: 'Technical Books & Gear',
        amount: 11500,
        type: 'EXPENSE',
        date: monthDayNoonUtc(2, 16),
        notes: 'Reference books & USB-C hub',
        isRecurring: false,
        recurringInterval: null,
        categoryId: catId('Shopping'),
        accountId: cardWallet.id,
        toAccountId: null,
      },
      {
        title: 'Lunch & Takeout',
        amount: 7600,
        type: 'EXPENSE',
        date: monthDayNoonUtc(2, 20),
        notes: 'Workday lunches',
        isRecurring: false,
        recurringInterval: null,
        categoryId: catId('Food & Dining'),
        accountId: cashWallet.id,
        toAccountId: null,
      },
      {
        title: 'Annual Health Screening',
        amount: 8400,
        type: 'EXPENSE',
        date: monthDayNoonUtc(2, 23),
        notes: 'Lab blood panel',
        isRecurring: false,
        recurringInterval: null,
        categoryId: catId('Healthcare'),
        accountId: bankWallet.id,
        toAccountId: null,
      },
      {
        title: 'Cash Wallet Top-Up',
        amount: 15000,
        type: 'TRANSFER',
        date: monthDayNoonUtc(2, 25),
        notes: 'ATM withdrawal',
        isRecurring: false,
        recurringInterval: null,
        categoryId: null,
        accountId: bankWallet.id,
        toAccountId: cashWallet.id,
      },
    ];

    await tx.transaction.createMany({
      data: sampleTransactions.map((t) => ({
        ...t,
        userId: user.id,
      })),
    });

    // 4 Monthly Budgets for current month (including >=80% warning & >=100% alert)
    const now = new Date();
    const curMonth = now.getUTCMonth() + 1;
    const curYear = now.getUTCFullYear();

    await tx.budget.createMany({
      data: [
        {
          amount: 30000, // Food spent this month: 14200 + 6400 + 6900 = 27500 (91.7% -> WARNING)
          month: curMonth,
          year: curYear,
          categoryId: catId('Food & Dining'),
          userId: user.id,
        },
        {
          amount: 20000, // Bills spent this month: 6800 + 14600 = 21400 (107% -> EXCEEDED)
          month: curMonth,
          year: curYear,
          categoryId: catId('Bills & Utilities'),
          userId: user.id,
        },
        {
          amount: 60000, // Rent spent this month: 55000 (91.7% -> WARNING)
          month: curMonth,
          year: curYear,
          categoryId: catId('Rent & Housing'),
          userId: user.id,
        },
        {
          amount: 25000, // Shopping spent this month: 16500 (66% -> OK)
          month: curMonth,
          year: curYear,
          categoryId: catId('Shopping'),
          userId: user.id,
        },
      ],
    });

    // 2 Savings Goals
    await tx.savingsGoal.createMany({
      data: [
        {
          title: 'Emergency Reserve Fund',
          targetAmount: 500000,
          currentAmount: 340000,
          deadline: futureMonthsNoonUtc(6),
          color: '#059669',
          userId: user.id,
        },
        {
          title: 'Workstation Upgrade',
          targetAmount: 420000,
          currentAmount: 195000,
          deadline: futureMonthsNoonUtc(4),
          color: '#4F46E5',
          userId: user.id,
        },
      ],
    });
  });
}
