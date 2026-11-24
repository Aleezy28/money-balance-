import type { Response } from 'express';
import { prisma } from '../lib/prisma.ts';
import type { AuthRequest } from '../middleware/authMiddleware.ts';

export async function getBudgets(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const now = new Date();
    const rawMonth = Number(req.query.month);
    const rawYear = Number(req.query.year);
    const month =
      Number.isInteger(rawMonth) && rawMonth >= 1 && rawMonth <= 12
        ? rawMonth
        : now.getUTCMonth() + 1;
    const year =
      Number.isInteger(rawYear) && rawYear >= 1970 && rawYear <= 2100
        ? rawYear
        : now.getUTCFullYear();

    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

    const [budgets, expenses] = await Promise.all([
      prisma.budget.findMany({
        where: { userId, month, year },
        include: { category: true },
        orderBy: { amount: 'desc' },
      }),
      prisma.transaction.findMany({
        where: {
          userId,
          type: 'EXPENSE',
          date: { gte: startDate, lt: endDate },
        },
        select: { categoryId: true, amount: true },
      }),
    ]);

    const spentCentsByCategory = new Map<number, number>();
    for (const tx of expenses) {
      if (tx.categoryId) {
        spentCentsByCategory.set(
          tx.categoryId,
          (spentCentsByCategory.get(tx.categoryId) || 0) + Math.round(tx.amount * 100)
        );
      }
    }

    const enriched = budgets.map((b) => {
      const spentCents = spentCentsByCategory.get(b.categoryId) || 0;
      const limitCents = Math.round(b.amount * 100);
      const spent = Math.round(spentCents) / 100;
      const remaining = Math.round(limitCents - spentCents) / 100;
      const percentage =
        limitCents > 0 ? Math.round((spentCents / limitCents) * 1000) / 10 : 0;
      const status =
        percentage >= 100 ? 'EXCEEDED' : percentage >= 80 ? 'WARNING' : 'OK';

      return {
        id: b.id,
        amount: b.amount,
        month: b.month,
        year: b.year,
        categoryId: b.categoryId,
        category: b.category,
        spent,
        remaining,
        percentage,
        status,
      };
    });

    res.json({ budgets: enriched, month, year });
  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({ error: 'Failed to load monthly budgets.' });
  }
}

export async function upsertBudget(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { categoryId, amount, month, year } = req.body as {
      categoryId?: number | string;
      amount?: number | string;
      month?: number | string;
      year?: number | string;
    };

    const parsedCategoryId = Number(categoryId);
    const numericAmount = Math.round(Number(amount) * 100) / 100;
    const now = new Date();
    const parsedMonth = Number(month) || now.getUTCMonth() + 1;
    const parsedYear = Number(year) || now.getUTCFullYear();

    if (!Number.isInteger(parsedCategoryId) || parsedCategoryId <= 0) {
      res.status(400).json({ error: 'Please select a valid expense category.' });
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      res.status(400).json({ error: 'Budget limit must be greater than 0.' });
      return;
    }
    if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
      res.status(400).json({ error: 'Month must be between 1 and 12.' });
      return;
    }
    if (!Number.isInteger(parsedYear) || parsedYear < 1970 || parsedYear > 2100) {
      res.status(400).json({ error: 'Year must be between 1970 and 2100.' });
      return;
    }

    const category = await prisma.category.findFirst({
      where: { id: parsedCategoryId, userId },
    });

    if (!category) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }
    if (category.type !== 'EXPENSE') {
      res.status(400).json({ error: 'Monthly budgets can only be set for expense categories.' });
      return;
    }

    const budget = await prisma.budget.upsert({
      where: {
        userId_categoryId_month_year: {
          userId,
          categoryId: parsedCategoryId,
          month: parsedMonth,
          year: parsedYear,
        },
      },
      update: { amount: numericAmount },
      create: {
        userId,
        categoryId: parsedCategoryId,
        amount: numericAmount,
        month: parsedMonth,
        year: parsedYear,
      },
      include: { category: true },
    });

    res.status(201).json({ budget });
  } catch (error) {
    console.error('Upsert budget error:', error);
    res.status(500).json({ error: 'Failed to save budget.' });
  }
}

export async function deleteBudget(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const budgetId = Number(req.params.id);

    if (!Number.isInteger(budgetId) || budgetId <= 0) {
      res.status(400).json({ error: 'Invalid budget ID.' });
      return;
    }

    const existing = await prisma.budget.findFirst({
      where: { id: budgetId, userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Budget not found.' });
      return;
    }

    await prisma.budget.delete({ where: { id: budgetId } });
    res.json({ message: 'Budget deleted.', deletedId: budgetId });
  } catch (error) {
    console.error('Delete budget error:', error);
    res.status(500).json({ error: 'Failed to delete budget.' });
  }
}
