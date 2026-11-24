import type { Response } from 'express';
import { prisma } from '../lib/prisma.ts';
import type { AuthRequest } from '../middleware/authMiddleware.ts';

const VALID_ACCOUNT_TYPES = new Set(['CASH', 'BANK', 'CARD', 'MOBILE_WALLET']);
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export async function getAccounts(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const accounts = await prisma.account.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        _count: {
          select: {
            transactions: true,
            incomingTransfers: true,
          },
        },
      },
    });

    const totalNetWorth =
      Math.round(accounts.reduce((sum, a) => sum + a.balance, 0) * 100) / 100;

    res.json({ accounts, totalNetWorth });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ error: 'Failed to load wallets.' });
  }
}

export async function createAccount(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { name, type, balance, color } = req.body as {
      name?: string;
      type?: string;
      balance?: number | string;
      color?: string;
    };

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const normalizedType = typeof type === 'string' ? type.trim().toUpperCase() : '';
    const numericBalance = balance !== undefined ? Number(balance) : 0;
    const validColor =
      typeof color === 'string' && HEX_COLOR_RE.test(color.trim())
        ? color.trim().toUpperCase()
        : '#0F766E';

    if (!trimmedName || trimmedName.length > 50) {
      res.status(400).json({ error: 'Wallet name is required (max 50 characters).' });
      return;
    }

    if (!VALID_ACCOUNT_TYPES.has(normalizedType)) {
      res.status(400).json({
        error: 'Wallet type must be CASH, BANK, CARD, or MOBILE_WALLET.',
      });
      return;
    }

    if (!Number.isFinite(numericBalance) || Math.abs(numericBalance) > 1_000_000_000_000) {
      res.status(400).json({ error: 'Initial balance must be a valid number within limits.' });
      return;
    }

    const account = await prisma.account.create({
      data: {
        name: trimmedName,
        type: normalizedType,
        balance: Math.round(numericBalance * 100) / 100,
        color: validColor,
        userId,
      },
      include: {
        _count: {
          select: { transactions: true, incomingTransfers: true },
        },
      },
    });

    res.status(201).json({ account });
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ error: 'Failed to create wallet.' });
  }
}

export async function updateAccount(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const accountId = Number(req.params.id);

    if (!Number.isInteger(accountId) || accountId <= 0) {
      res.status(400).json({ error: 'Invalid wallet ID.' });
      return;
    }

    const existing = await prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Wallet not found.' });
      return;
    }

    const { name, type, balance, color } = req.body as {
      name?: string;
      type?: string;
      balance?: number | string;
      color?: string;
    };

    const nextName = name !== undefined ? String(name).trim() : existing.name;
    const nextType =
      type !== undefined ? String(type).trim().toUpperCase() : existing.type;
    const nextBalance =
      balance !== undefined ? Number(balance) : existing.balance;
    const nextColor =
      color !== undefined && HEX_COLOR_RE.test(String(color).trim())
        ? String(color).trim().toUpperCase()
        : existing.color;

    if (!nextName || nextName.length > 50) {
      res.status(400).json({ error: 'Wallet name is required (max 50 characters).' });
      return;
    }
    if (!VALID_ACCOUNT_TYPES.has(nextType)) {
      res.status(400).json({
        error: 'Wallet type must be CASH, BANK, CARD, or MOBILE_WALLET.',
      });
      return;
    }
    if (!Number.isFinite(nextBalance) || Math.abs(nextBalance) > 1_000_000_000_000) {
      res.status(400).json({ error: 'Balance must be a valid number within limits.' });
      return;
    }

    const account = await prisma.account.update({
      where: { id: accountId },
      data: {
        name: nextName,
        type: nextType,
        balance: Math.round(nextBalance * 100) / 100,
        color: nextColor,
      },
      include: {
        _count: {
          select: { transactions: true, incomingTransfers: true },
        },
      },
    });

    res.json({ account });
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ error: 'Failed to update wallet.' });
  }
}

export async function deleteAccount(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const accountId = Number(req.params.id);

    if (!Number.isInteger(accountId) || accountId <= 0) {
      res.status(400).json({ error: 'Invalid wallet ID.' });
      return;
    }

    const existing = await prisma.account.findFirst({
      where: { id: accountId, userId },
      include: {
        _count: {
          select: { transactions: true, incomingTransfers: true },
        },
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'Wallet not found.' });
      return;
    }

    const totalRefs =
      existing._count.transactions + existing._count.incomingTransfers;
    if (totalRefs > 0) {
      res.status(400).json({
        error: `Cannot delete "${existing.name}" because ${totalRefs} transaction(s) reference it. Delete or reassign those transactions first.`,
      });
      return;
    }

    await prisma.account.delete({ where: { id: accountId } });
    res.json({ message: 'Wallet deleted.', deletedId: accountId });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete wallet.' });
  }
}

export async function getAccountLedger(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const accountId = Number(req.params.id);

    if (!Number.isInteger(accountId) || accountId <= 0) {
      res.status(400).json({ error: 'Invalid wallet ID.' });
      return;
    }

    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      res.status(404).json({ error: 'Wallet not found.' });
      return;
    }

    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };

    const parseYmdBound = (raw: string | undefined, endOfDay: boolean): Date | null | 'invalid' => {
      if (!raw || !raw.trim()) return null;
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
      if (!m) return 'invalid';
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      const dt = new Date(
        Date.UTC(y, mo - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0)
      );
      if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
        return 'invalid';
      }
      return dt;
    };

    const startBound = parseYmdBound(startDate, false);
    const endBound = parseYmdBound(endDate, true);
    if (startBound === 'invalid' || endBound === 'invalid') {
      res.status(400).json({ error: 'Invalid date range filter (expected YYYY-MM-DD).' });
      return;
    }

    const allTxs = await prisma.transaction.findMany({
      where: {
        userId,
        OR: [{ accountId }, { toAccountId: accountId }],
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      include: {
        category: true,
        account: true,
        toAccount: true,
      },
    });

    const toCents = (val: number) => Math.round(val * 100);
    const fromCents = (cents: number) => Math.round(cents) / 100;

    const computeDeltaCents = (tx: (typeof allTxs)[number]) => {
      const amtCents = toCents(tx.amount);
      if (tx.type === 'INCOME' && tx.accountId === accountId) return amtCents;
      if (tx.type === 'EXPENSE' && tx.accountId === accountId) return -amtCents;
      if (tx.type === 'TRANSFER') {
        if (tx.toAccountId === accountId) return amtCents;
        if (tx.accountId === accountId) return -amtCents;
      }
      return 0;
    };

    const currentBalanceCents = toCents(account.balance);
    const totalAllTxDeltaCents = allTxs.reduce(
      (sum, tx) => sum + computeDeltaCents(tx),
      0
    );
    const initialCapitalCents = currentBalanceCents - totalAllTxDeltaCents;

    let runningCents = initialCapitalCents;
    let openingBalanceCents = initialCapitalCents;
    let totalInflowCents = 0;
    let totalOutflowCents = 0;
    let capturedOpening = !startBound;

    const entries: Array<{
      id: number;
      date: Date;
      createdAt: Date;
      title: string;
      type: string;
      notes: string | null;
      categoryName: string;
      counterparty: string;
      inflow: number;
      outflow: number;
      runningBalance: number;
    }> = [];

    for (const tx of allTxs) {
      const txTime = tx.date.getTime();
      if (startBound && !capturedOpening && txTime >= startBound.getTime()) {
        openingBalanceCents = runningCents;
        capturedOpening = true;
      }

      const deltaCents = computeDeltaCents(tx);
      runningCents += deltaCents;

      const afterStart = !startBound || txTime >= startBound.getTime();
      const beforeEnd = !endBound || txTime <= endBound.getTime();

      if (afterStart && beforeEnd) {
        const inflowCents = deltaCents > 0 ? deltaCents : 0;
        const outflowCents = deltaCents < 0 ? Math.abs(deltaCents) : 0;
        totalInflowCents += inflowCents;
        totalOutflowCents += outflowCents;

        const counterparty =
          tx.type === 'TRANSFER'
            ? tx.toAccountId === accountId
              ? `From ${tx.account.name}`
              : `To ${tx.toAccount?.name || 'Wallet'}`
            : tx.category?.name || tx.type;

        entries.push({
          id: tx.id,
          date: tx.date,
          createdAt: tx.createdAt,
          title: tx.title,
          type: tx.type,
          notes: tx.notes,
          categoryName: tx.category?.name || 'Transfer',
          counterparty,
          inflow: fromCents(inflowCents),
          outflow: fromCents(outflowCents),
          runningBalance: fromCents(runningCents),
        });
      }
    }

    if (startBound && !capturedOpening) {
      openingBalanceCents = runningCents;
    }

    const closingBalanceCents =
      openingBalanceCents + totalInflowCents - totalOutflowCents;

    res.json({
      account,
      openingBalance: fromCents(openingBalanceCents),
      closingBalance: fromCents(closingBalanceCents),
      totalInflow: fromCents(totalInflowCents),
      totalOutflow: fromCents(totalOutflowCents),
      entries,
    });
  } catch (error) {
    console.error('Get account ledger error:', error);
    res.status(500).json({ error: 'Failed to load account ledger.' });
  }
}
