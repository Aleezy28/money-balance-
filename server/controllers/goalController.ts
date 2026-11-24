import type { Response } from 'express';
import { prisma } from '../lib/prisma.ts';
import type { AuthRequest } from '../middleware/authMiddleware.ts';

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

function parseOptionalDate(input: unknown): Date | null {
  if (!input || typeof input !== 'string' || !input.trim()) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input.trim());
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0));
}

export async function getGoals(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const goals = await prisma.savingsGoal.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }],
    });

    res.json({ goals });
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ error: 'Failed to load savings goals.' });
  }
}

export async function createGoal(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { title, targetAmount, currentAmount, deadline, color } = req.body as {
      title?: string;
      targetAmount?: number | string;
      currentAmount?: number | string;
      deadline?: string | null;
      color?: string;
    };

    const trimmedTitle = typeof title === 'string' ? title.trim() : '';
    const target = Math.round(Number(targetAmount) * 100) / 100;
    const current =
      currentAmount !== undefined ? Math.round(Number(currentAmount) * 100) / 100 : 0;
    const parsedDeadline = parseOptionalDate(deadline);
    const validColor =
      typeof color === 'string' && HEX_COLOR_RE.test(color.trim())
        ? color.trim().toUpperCase()
        : '#059669';

    if (!trimmedTitle || trimmedTitle.length > 80) {
      res.status(400).json({ error: 'Goal title is required (max 80 characters).' });
      return;
    }
    if (!Number.isFinite(target) || target <= 0) {
      res.status(400).json({ error: 'Target amount must be greater than 0.' });
      return;
    }
    if (!Number.isFinite(current) || current < 0) {
      res.status(400).json({ error: 'Current amount cannot be negative.' });
      return;
    }

    const goal = await prisma.savingsGoal.create({
      data: {
        title: trimmedTitle,
        targetAmount: target,
        currentAmount: current,
        deadline: parsedDeadline,
        color: validColor,
        userId,
      },
    });

    res.status(201).json({ goal });
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ error: 'Failed to create savings goal.' });
  }
}

export async function updateGoal(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const goalId = Number(req.params.id);

    if (!Number.isInteger(goalId) || goalId <= 0) {
      res.status(400).json({ error: 'Invalid goal ID.' });
      return;
    }

    const existing = await prisma.savingsGoal.findFirst({
      where: { id: goalId, userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Savings goal not found.' });
      return;
    }

    const { title, targetAmount, currentAmount, deadline, color } = req.body as {
      title?: string;
      targetAmount?: number | string;
      currentAmount?: number | string;
      deadline?: string | null;
      color?: string;
    };

    const nextTitle = title !== undefined ? String(title).trim() : existing.title;
    const nextTarget =
      targetAmount !== undefined
        ? Math.round(Number(targetAmount) * 100) / 100
        : existing.targetAmount;
    const nextCurrent =
      currentAmount !== undefined
        ? Math.round(Number(currentAmount) * 100) / 100
        : existing.currentAmount;
    const nextDeadline =
      deadline !== undefined ? parseOptionalDate(deadline) : existing.deadline;
    const nextColor =
      color !== undefined && HEX_COLOR_RE.test(String(color).trim())
        ? String(color).trim().toUpperCase()
        : existing.color;

    if (!nextTitle || nextTitle.length > 80) {
      res.status(400).json({ error: 'Goal title is required (max 80 characters).' });
      return;
    }
    if (!Number.isFinite(nextTarget) || nextTarget <= 0) {
      res.status(400).json({ error: 'Target amount must be greater than 0.' });
      return;
    }
    if (!Number.isFinite(nextCurrent) || nextCurrent < 0) {
      res.status(400).json({ error: 'Current amount cannot be negative.' });
      return;
    }

    const goal = await prisma.savingsGoal.update({
      where: { id: goalId },
      data: {
        title: nextTitle,
        targetAmount: nextTarget,
        currentAmount: nextCurrent,
        deadline: nextDeadline,
        color: nextColor,
      },
    });

    res.json({ goal });
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({ error: 'Failed to update savings goal.' });
  }
}

export async function contributeToGoal(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const goalId = Number(req.params.id);
    const { amount, accountId } = req.body as {
      amount?: number | string;
      accountId?: number | string | null;
    };

    if (!Number.isInteger(goalId) || goalId <= 0) {
      res.status(400).json({ error: 'Invalid goal ID.' });
      return;
    }

    const contribution = Math.round(Number(amount) * 100) / 100;
    if (!Number.isFinite(contribution) || contribution <= 0) {
      res.status(400).json({ error: 'Contribution amount must be greater than 0.' });
      return;
    }

    const existing = await prisma.savingsGoal.findFirst({
      where: { id: goalId, userId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Savings goal not found.' });
      return;
    }

    let parsedAccountId: number | null = null;
    if (accountId !== undefined && accountId !== null && accountId !== '') {
      parsedAccountId = Number(accountId);
      if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
        res.status(400).json({ error: 'Invalid wallet ID.' });
        return;
      }
      const account = await prisma.account.findFirst({
        where: { id: parsedAccountId, userId },
      });
      if (!account) {
        res.status(404).json({ error: 'Selected wallet not found.' });
        return;
      }
    }

    const goal = await prisma.$transaction(async (tx) => {
      const contributionCents = Math.round(contribution * 100);
      if (parsedAccountId) {
        const account = await tx.account.findUnique({
          where: { id: parsedAccountId },
          select: { balance: true },
        });
        if (account) {
          const nextBalance =
            (Math.round(account.balance * 100) - contributionCents) / 100;
          await tx.account.update({
            where: { id: parsedAccountId },
            data: { balance: nextBalance },
          });
        }
      }

      const freshGoal = await tx.savingsGoal.findUnique({
        where: { id: goalId },
        select: { currentAmount: true },
      });
      const baseCents = Math.round((freshGoal?.currentAmount ?? existing.currentAmount) * 100);
      const nextGoalAmount = (baseCents + contributionCents) / 100;
      return tx.savingsGoal.update({
        where: { id: goalId },
        data: {
          currentAmount: nextGoalAmount,
        },
      });
    });

    res.json({ goal });
  } catch (error) {
    console.error('Contribute goal error:', error);
    res.status(500).json({ error: 'Failed to add contribution.' });
  }
}

export async function deleteGoal(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const goalId = Number(req.params.id);

    if (!Number.isInteger(goalId) || goalId <= 0) {
      res.status(400).json({ error: 'Invalid goal ID.' });
      return;
    }

    const existing = await prisma.savingsGoal.findFirst({
      where: { id: goalId, userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Savings goal not found.' });
      return;
    }

    await prisma.savingsGoal.delete({ where: { id: goalId } });
    res.json({ message: 'Savings goal deleted.', deletedId: goalId });
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ error: 'Failed to delete savings goal.' });
  }
}
