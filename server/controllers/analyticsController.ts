import type { Response } from 'express';
import { prisma } from '../lib/prisma.ts';
import type { AuthRequest } from '../middleware/authMiddleware.ts';

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

function pctDelta(currentCents: number, previousCents: number): number | null {
  if (previousCents <= 0 && currentCents <= 0) return 0;
  if (previousCents <= 0) return null;
  return Math.round(((currentCents - previousCents) / previousCents) * 1000) / 10;
}

function parseMonthYear(
  rawMonth: unknown,
  rawYear: unknown
): { month: number; year: number } {
  const now = new Date();
  const m = Number(rawMonth);
  const y = Number(rawYear);
  return {
    month:
      Number.isInteger(m) && m >= 1 && m <= 12 ? m : now.getUTCMonth() + 1,
    year:
      Number.isInteger(y) && y >= 1970 && y <= 2100 ? y : now.getUTCFullYear(),
  };
}

export async function getAnalytics(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { month, year } = parseMonthYear(req.query.month, req.query.year);

    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const prevStartDate = new Date(Date.UTC(year, month - 2, 1, 0, 0, 0, 0));
    const prevEndDate = startDate;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const [
      accounts,
      monthTransactions,
      prevMonthTransactions,
      allTransactions,
      budgets,
      goals,
      recentTransactions,
    ] = await Promise.all([
      prisma.account.findMany({ where: { userId }, orderBy: { balance: 'desc' } }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: startDate, lt: endDate } },
        include: { category: true, account: true, toAccount: true },
      }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: prevStartDate, lt: prevEndDate } },
        select: { amount: true, type: true },
      }),
      prisma.transaction.findMany({
        where: { userId },
        select: { amount: true, type: true, date: true },
      }),
      prisma.budget.findMany({
        where: { userId, month, year },
        include: { category: true },
      }),
      prisma.savingsGoal.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.findMany({
        where: { userId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 6,
        include: { category: true, account: true, toAccount: true },
      }),
    ]);

    const totalNetWorthCents = accounts.reduce(
      (sum, acc) => sum + toCents(acc.balance),
      0
    );
    const totalNetWorth = fromCents(totalNetWorthCents);

    let monthlyIncomeCents = 0;
    let monthlyExpenseCents = 0;

    const expenseByCategory = new Map<
      number,
      { categoryId: number; name: string; color: string; totalCents: number; count: number }
    >();
    const dailyExpenseCents = new Array<number>(daysInMonth).fill(0);

    for (const tx of monthTransactions) {
      const txCents = toCents(tx.amount);
      const dayIdx = tx.date.getUTCDate() - 1;
      if (tx.type === 'INCOME') {
        monthlyIncomeCents += txCents;
      } else if (tx.type === 'EXPENSE') {
        monthlyExpenseCents += txCents;

        if (dayIdx >= 0 && dayIdx < daysInMonth) {
          dailyExpenseCents[dayIdx] += txCents;
        }

        if (tx.categoryId && tx.category) {
          const cur = expenseByCategory.get(tx.categoryId);
          if (cur) {
            cur.totalCents += txCents;
            cur.count += 1;
          } else {
            expenseByCategory.set(tx.categoryId, {
              categoryId: tx.categoryId,
              name: tx.category.name,
              color: tx.category.color,
              totalCents: txCents,
              count: 1,
            });
          }
        }
      }
    }

    let prevIncomeCents = 0;
    let prevExpenseCents = 0;
    for (const tx of prevMonthTransactions) {
      const txCents = toCents(tx.amount);
      if (tx.type === 'INCOME') prevIncomeCents += txCents;
      else if (tx.type === 'EXPENSE') prevExpenseCents += txCents;
    }

    const monthlyIncome = fromCents(monthlyIncomeCents);
    const monthlyExpense = fromCents(monthlyExpenseCents);
    const netCashflowCents = monthlyIncomeCents - monthlyExpenseCents;
    const savingsRate =
      monthlyIncomeCents > 0
        ? Math.round((netCashflowCents / monthlyIncomeCents) * 1000) / 10
        : 0;

    const categoryBreakdown = Array.from(expenseByCategory.values())
      .map((c) => ({
        categoryId: c.categoryId,
        name: c.name,
        color: c.color,
        count: c.count,
        total: fromCents(c.totalCents),
        percentage:
          monthlyExpenseCents > 0
            ? Math.round((c.totalCents / monthlyExpenseCents) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.total - a.total);

    let cumulativeCents = 0;
    const dailySpendingCurve = dailyExpenseCents.map((dayCents, index) => {
      cumulativeCents += dayCents;
      return {
        day: index + 1,
        label: String(index + 1),
        expense: fromCents(dayCents),
        cumulative: fromCents(cumulativeCents),
      };
    });

    const monthFormatter = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC',
    });

    const monthlyTrendCents: Array<{
      key: string;
      label: string;
      incomeCents: number;
      expenseCents: number;
    }> = [];
    const trendIndexMap = new Map<string, number>();

    for (let offset = 5; offset >= 0; offset--) {
      const d = new Date(Date.UTC(year, month - 1 - offset, 1, 12, 0, 0, 0));
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      const key = `${y}-${String(m).padStart(2, '0')}`;
      trendIndexMap.set(key, monthlyTrendCents.length);
      monthlyTrendCents.push({
        key,
        label: monthFormatter.format(d),
        incomeCents: 0,
        expenseCents: 0,
      });
    }

    for (const tx of allTransactions) {
      const key = `${tx.date.getUTCFullYear()}-${String(tx.date.getUTCMonth() + 1).padStart(2, '0')}`;
      const idx = trendIndexMap.get(key);
      if (idx !== undefined) {
        const txCents = toCents(tx.amount);
        if (tx.type === 'INCOME') {
          monthlyTrendCents[idx].incomeCents += txCents;
        } else if (tx.type === 'EXPENSE') {
          monthlyTrendCents[idx].expenseCents += txCents;
        }
      }
    }

    const monthlyTrend = monthlyTrendCents.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      income: fromCents(bucket.incomeCents),
      expense: fromCents(bucket.expenseCents),
      net: fromCents(bucket.incomeCents - bucket.expenseCents),
    }));

    const budgetAlerts = budgets
      .map((b) => {
        const spentCents = expenseByCategory.get(b.categoryId)?.totalCents || 0;
        const limitCents = toCents(b.amount);
        const remainingCents = limitCents - spentCents;
        const percentage =
          limitCents > 0 ? Math.round((spentCents / limitCents) * 1000) / 10 : 0;
        const status =
          percentage >= 100 ? 'EXCEEDED' : percentage >= 80 ? 'WARNING' : 'OK';
        return {
          id: b.id,
          categoryId: b.categoryId,
          categoryName: b.category.name,
          categoryColor: b.category.color,
          limit: fromCents(limitCents),
          spent: fromCents(spentCents),
          remaining: fromCents(remainingCents),
          percentage,
          status,
        };
      })
      .sort((a, b) => b.percentage - a.percentage);

    res.json({
      month,
      year,
      kpis: {
        totalNetWorth,
        monthlyIncome,
        monthlyExpense,
        savingsRate,
        incomeDeltaPct: pctDelta(monthlyIncomeCents, prevIncomeCents),
        expenseDeltaPct: pctDelta(monthlyExpenseCents, prevExpenseCents),
        netCashflow: fromCents(netCashflowCents),
        prevNetCashflow: fromCents(prevIncomeCents - prevExpenseCents),
      },
      sparklines: {
        income: monthlyTrend.map((m) => m.income),
        expense: monthlyTrend.map((m) => m.expense),
        net: monthlyTrend.map((m) => m.net),
      },
      categoryBreakdown,
      monthlyTrend,
      dailySpendingCurve,
      budgetAlerts,
      goals,
      recentTransactions,
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to load dashboard analytics.' });
  }
}

export async function getMonthlyReport(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { month, year } = parseMonthYear(req.query.month, req.query.year);

    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

    const [user, accounts, transactions, budgets, goals] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true, currency: true, monthlyIncomeGoal: true },
      }),
      prisma.account.findMany({ where: { userId }, orderBy: { balance: 'desc' } }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: startDate, lt: endDate } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: { category: true, account: true, toAccount: true },
      }),
      prisma.budget.findMany({
        where: { userId, month, year },
        include: { category: true },
      }),
      prisma.savingsGoal.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalNetWorth = fromCents(
      accounts.reduce((sum, a) => sum + toCents(a.balance), 0)
    );

    let totalIncomeCents = 0;
    let totalExpenseCents = 0;
    let totalTransfersCents = 0;

    const expenseByCategory = new Map<
      number,
      { name: string; color: string; totalCents: number; count: number }
    >();

    for (const tx of transactions) {
      const txCents = toCents(tx.amount);
      if (tx.type === 'INCOME') {
        totalIncomeCents += txCents;
      } else if (tx.type === 'EXPENSE') {
        totalExpenseCents += txCents;
        if (tx.categoryId && tx.category) {
          const cur = expenseByCategory.get(tx.categoryId);
          if (cur) {
            cur.totalCents += txCents;
            cur.count += 1;
          } else {
            expenseByCategory.set(tx.categoryId, {
              name: tx.category.name,
              color: tx.category.color,
              totalCents: txCents,
              count: 1,
            });
          }
        }
      } else if (tx.type === 'TRANSFER') {
        totalTransfersCents += txCents;
      }
    }

    const totalIncome = fromCents(totalIncomeCents);
    const totalExpense = fromCents(totalExpenseCents);
    const totalTransfers = fromCents(totalTransfersCents);
    const netSavingsCents = totalIncomeCents - totalExpenseCents;
    const netSavings = fromCents(netSavingsCents);
    const savingsRate =
      totalIncomeCents > 0
        ? Math.round((netSavingsCents / totalIncomeCents) * 1000) / 10
        : 0;

    const categoryBreakdown = Array.from(expenseByCategory.values())
      .map((c) => ({
        name: c.name,
        color: c.color,
        count: c.count,
        total: fromCents(c.totalCents),
        percentage:
          totalExpenseCents > 0
            ? Math.round((c.totalCents / totalExpenseCents) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const budgetSummary = budgets.map((b) => {
      const spentCents = expenseByCategory.get(b.categoryId)?.totalCents || 0;
      const limitCents = toCents(b.amount);
      const remainingCents = limitCents - spentCents;
      const percentage =
        limitCents > 0 ? Math.round((spentCents / limitCents) * 1000) / 10 : 0;
      const status =
        percentage >= 100 ? 'EXCEEDED' : percentage >= 80 ? 'WARNING' : 'ON_TRACK';
      return {
        categoryName: b.category.name,
        limit: fromCents(limitCents),
        spent: fromCents(spentCents),
        remaining: fromCents(remainingCents),
        percentage,
        status,
      };
    });

    res.json({
      generatedAt: new Date().toISOString(),
      month,
      year,
      user,
      summary: {
        totalNetWorth,
        totalIncome,
        totalExpense,
        totalTransfers,
        netSavings,
        savingsRate,
        transactionCount: transactions.length,
      },
      accounts,
      categoryBreakdown,
      budgetSummary,
      goals,
      transactions,
    });
  } catch (error) {
    console.error('Get monthly report error:', error);
    res.status(500).json({ error: 'Failed to prepare monthly financial report.' });
  }
}

export async function getWorkspaceAlerts(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const year = now.getUTCFullYear();
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

    const [accounts, budgets, monthExpenses, goals] = await Promise.all([
      prisma.account.findMany({ where: { userId }, orderBy: { balance: 'asc' } }),
      prisma.budget.findMany({
        where: { userId, month, year },
        include: { category: true },
      }),
      prisma.transaction.findMany({
        where: {
          userId,
          type: 'EXPENSE',
          date: { gte: startDate, lt: endDate },
        },
        select: { categoryId: true, amount: true },
      }),
      prisma.savingsGoal.findMany({ where: { userId } }),
    ]);

    const spentByCategory = new Map<number, number>();
    for (const tx of monthExpenses) {
      if (tx.categoryId) {
        spentByCategory.set(
          tx.categoryId,
          (spentByCategory.get(tx.categoryId) || 0) + toCents(tx.amount)
        );
      }
    }

    const alerts: Array<{
      id: string;
      severity: 'CRITICAL' | 'WARNING' | 'INFO';
      kind: 'OVERDRAFT' | 'BUDGET' | 'GOAL';
      title: string;
      message: string;
      link: string;
      amount?: number;
      accountName?: string;
    }> = [];

    for (const acc of accounts) {
      const balCents = toCents(acc.balance);
      if (balCents < 0) {
        alerts.push({
          id: `overdraft-${acc.id}`,
          severity: 'CRITICAL',
          kind: 'OVERDRAFT',
          title: `${acc.name} is overdrawn`,
          message: `Balance is ${fromCents(balCents)}. Transfer funds from a positive wallet or verify recent expenses.`,
          link: `/accounts/ledger?accountId=${acc.id}`,
          amount: fromCents(balCents),
          accountName: acc.name,
        });
      }
    }

    for (const b of budgets) {
      const spentCents = spentByCategory.get(b.categoryId) || 0;
      const limitCents = toCents(b.amount);
      if (limitCents <= 0) continue;
      const pct = Math.round((spentCents / limitCents) * 1000) / 10;
      if (pct >= 100) {
        alerts.push({
          id: `budget-exceeded-${b.id}`,
          severity: 'CRITICAL',
          kind: 'BUDGET',
          title: `${b.category.name} budget exceeded (${pct}%)`,
          message: `Spent ${fromCents(spentCents)} of ${fromCents(limitCents)} limit this month.`,
          link: '/budgets',
          amount: fromCents(spentCents - limitCents),
        });
      } else if (pct >= 80) {
        alerts.push({
          id: `budget-warn-${b.id}`,
          severity: 'WARNING',
          kind: 'BUDGET',
          title: `${b.category.name} budget at ${pct}%`,
          message: `Only ${fromCents(limitCents - spentCents)} remaining for this month.`,
          link: '/budgets',
          amount: fromCents(limitCents - spentCents),
        });
      }
    }

    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
    for (const g of goals) {
      if (!g.deadline) continue;
      const remainingCents = toCents(g.targetAmount) - toCents(g.currentAmount);
      if (remainingCents <= 0) continue;
      const diff = g.deadline.getTime() - now.getTime();
      if (diff <= fourteenDaysMs) {
        alerts.push({
          id: `goal-due-${g.id}`,
          severity: diff < 0 ? 'CRITICAL' : 'INFO',
          kind: 'GOAL',
          title:
            diff < 0
              ? `Goal deadline passed: ${g.title}`
              : `Goal deadline approaching: ${g.title}`,
          message: `${fromCents(remainingCents)} still needed to reach target.`,
          link: '/goals',
          amount: fromCents(remainingCents),
        });
      }
    }

    res.json({ alerts, count: alerts.length });
  } catch (error) {
    console.error('Get workspace alerts error:', error);
    res.status(500).json({ error: 'Failed to load alerts.' });
  }
}

export async function getAccountingStatements(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.userId!;
    const scope = req.query.scope === 'all' ? 'all' : 'month';
    const { month, year } = parseMonthYear(req.query.month, req.query.year);

    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

    const [accounts, categories, allTransactions] = await Promise.all([
      prisma.account.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'asc' }],
        include: {
          _count: {
            select: { transactions: true, incomingTransfers: true },
          },
        },
      }),
      prisma.category.findMany({
        where: { userId },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
        include: {
          _count: { select: { transactions: true } },
        },
      }),
      prisma.transaction.findMany({
        where: { userId },
        include: { category: true, account: true, toAccount: true },
      }),
    ]);

    let allTimeIncomeCents = 0;
    let allTimeExpenseCents = 0;
    let periodIncomeCents = 0;
    let periodExpenseCents = 0;
    let priorRetainedCents = 0;

    const categoryPeriodCents = new Map<number, number>();
    const categoryAllTimeCents = new Map<number, number>();

    for (const tx of allTransactions) {
      const amtCents = toCents(tx.amount);
      const inPeriod =
        scope === 'all' ||
        (tx.date.getTime() >= startDate.getTime() &&
          tx.date.getTime() < endDate.getTime());

      if (tx.type === 'INCOME') {
        allTimeIncomeCents += amtCents;
        if (tx.categoryId) {
          categoryAllTimeCents.set(
            tx.categoryId,
            (categoryAllTimeCents.get(tx.categoryId) || 0) + amtCents
          );
        }
        if (inPeriod) {
          periodIncomeCents += amtCents;
          if (tx.categoryId) {
            categoryPeriodCents.set(
              tx.categoryId,
              (categoryPeriodCents.get(tx.categoryId) || 0) + amtCents
            );
          }
        } else {
          priorRetainedCents += amtCents;
        }
      } else if (tx.type === 'EXPENSE') {
        allTimeExpenseCents += amtCents;
        if (tx.categoryId) {
          categoryAllTimeCents.set(
            tx.categoryId,
            (categoryAllTimeCents.get(tx.categoryId) || 0) + amtCents
          );
        }
        if (inPeriod) {
          periodExpenseCents += amtCents;
          if (tx.categoryId) {
            categoryPeriodCents.set(
              tx.categoryId,
              (categoryPeriodCents.get(tx.categoryId) || 0) + amtCents
            );
          }
        } else {
          priorRetainedCents -= amtCents;
        }
      }
    }

    let totalAssetsCents = 0;
    let totalLiabilitiesCents = 0;

    const assetAccounts: Array<{
      id: number;
      code: string;
      name: string;
      type: string;
      color: string;
      balance: number;
      txCount: number;
    }> = [];

    const liabilityAccounts: Array<{
      id: number;
      code: string;
      name: string;
      type: string;
      color: string;
      balance: number;
      txCount: number;
    }> = [];

    accounts.forEach((acc, idx) => {
      const balCents = toCents(acc.balance);
      const txCount =
        (acc._count?.transactions ?? 0) + (acc._count?.incomingTransfers ?? 0);
      if (balCents >= 0) {
        totalAssetsCents += balCents;
        assetAccounts.push({
          id: acc.id,
          code: String(1010 + idx * 10),
          name: acc.name,
          type: acc.type,
          color: acc.color,
          balance: fromCents(balCents),
          txCount,
        });
      } else {
        totalLiabilitiesCents += Math.abs(balCents);
        liabilityAccounts.push({
          id: acc.id,
          code: String(2010 + idx * 10),
          name: acc.name,
          type: acc.type,
          color: acc.color,
          balance: fromCents(Math.abs(balCents)),
          txCount,
        });
      }
    });

    const netWorthCents = totalAssetsCents - totalLiabilitiesCents;
    const allTimeNetEarningsCents = allTimeIncomeCents - allTimeExpenseCents;
    // Initial/Manual wallet capital makes Assets = Liabilities + OpeningCapital + RetainedEarnings exact
    const openingCapitalCents = netWorthCents - allTimeNetEarningsCents;

    const incomeCategories = categories
      .filter((c) => c.type === 'INCOME')
      .map((c, idx) => ({
        id: c.id,
        code: String(4010 + idx * 10),
        name: c.name,
        color: c.color,
        periodTotal: fromCents(categoryPeriodCents.get(c.id) || 0),
        allTimeTotal: fromCents(categoryAllTimeCents.get(c.id) || 0),
        txCount: c._count?.transactions ?? 0,
      }));

    const expenseCategories = categories
      .filter((c) => c.type === 'EXPENSE')
      .map((c, idx) => ({
        id: c.id,
        code: String(5010 + idx * 10),
        name: c.name,
        color: c.color,
        periodTotal: fromCents(categoryPeriodCents.get(c.id) || 0),
        allTimeTotal: fromCents(categoryAllTimeCents.get(c.id) || 0),
        txCount: c._count?.transactions ?? 0,
      }));

    // Trial Balance rows: strictly balanced Debits === Credits
    const trialRows: Array<{
      code: string;
      accountName: string;
      group: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
      debit: number;
      credit: number;
    }> = [];

    accounts.forEach((acc, idx) => {
      const balCents = toCents(acc.balance);
      trialRows.push({
        code: String(1010 + idx * 10),
        accountName: `${acc.name} (${acc.type})`,
        group: balCents >= 0 ? 'ASSET' : 'LIABILITY',
        debit: balCents >= 0 ? fromCents(balCents) : 0,
        credit: balCents < 0 ? fromCents(Math.abs(balCents)) : 0,
      });
    });

    if (openingCapitalCents !== 0) {
      trialRows.push({
        code: '3010',
        accountName: 'Opening & Adjusted Wallet Capital',
        group: 'EQUITY',
        debit: openingCapitalCents < 0 ? fromCents(Math.abs(openingCapitalCents)) : 0,
        credit: openingCapitalCents > 0 ? fromCents(openingCapitalCents) : 0,
      });
    }

    if (scope === 'month' && priorRetainedCents !== 0) {
      trialRows.push({
        code: '3020',
        accountName: 'Prior Periods Retained Earnings',
        group: 'EQUITY',
        debit: priorRetainedCents < 0 ? fromCents(Math.abs(priorRetainedCents)) : 0,
        credit: priorRetainedCents > 0 ? fromCents(priorRetainedCents) : 0,
      });
    }

    for (const ic of incomeCategories) {
      const val = scope === 'all' ? ic.allTimeTotal : ic.periodTotal;
      if (val > 0) {
        trialRows.push({
          code: ic.code,
          accountName: ic.name,
          group: 'INCOME',
          debit: 0,
          credit: val,
        });
      }
    }

    for (const ec of expenseCategories) {
      const val = scope === 'all' ? ec.allTimeTotal : ec.periodTotal;
      if (val > 0) {
        trialRows.push({
          code: ec.code,
          accountName: ec.name,
          group: 'EXPENSE',
          debit: val,
          credit: 0,
        });
      }
    }

    const totalDebitsCents = trialRows.reduce((s, r) => s + toCents(r.debit), 0);
    const totalCreditsCents = trialRows.reduce((s, r) => s + toCents(r.credit), 0);

    const periodNetCents = periodIncomeCents - periodExpenseCents;
    const savingsRate =
      periodIncomeCents > 0
        ? Math.round((periodNetCents / periodIncomeCents) * 1000) / 10
        : 0;

    res.json({
      scope,
      month,
      year,
      chartOfAccounts: {
        assets: assetAccounts,
        liabilities: liabilityAccounts,
        incomeCategories,
        expenseCategories,
      },
      balanceSheet: {
        assets: assetAccounts,
        liabilities: liabilityAccounts,
        totalAssets: fromCents(totalAssetsCents),
        totalLiabilities: fromCents(totalLiabilitiesCents),
        openingCapital: fromCents(openingCapitalCents),
        retainedEarnings: fromCents(allTimeNetEarningsCents),
        totalEquity: fromCents(netWorthCents),
        totalLiabilitiesAndEquity: fromCents(totalLiabilitiesCents + netWorthCents),
        isBalanced: totalAssetsCents === totalLiabilitiesCents + netWorthCents,
      },
      profitAndLoss: {
        incomeItems: incomeCategories.filter((c) =>
          (scope === 'all' ? c.allTimeTotal : c.periodTotal) > 0
        ),
        expenseItems: expenseCategories.filter((c) =>
          (scope === 'all' ? c.allTimeTotal : c.periodTotal) > 0
        ),
        totalIncome: fromCents(periodIncomeCents),
        totalExpense: fromCents(periodExpenseCents),
        netProfit: fromCents(periodNetCents),
        savingsRate,
      },
      trialBalance: {
        rows: trialRows,
        totalDebits: fromCents(totalDebitsCents),
        totalCredits: fromCents(totalCreditsCents),
        difference: fromCents(totalDebitsCents - totalCreditsCents),
        isBalanced: totalDebitsCents === totalCreditsCents,
      },
    });
  } catch (error) {
    console.error('Get accounting statements error:', error);
    res.status(500).json({ error: 'Failed to prepare accounting statements.' });
  }
}
