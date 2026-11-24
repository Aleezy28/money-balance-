import type { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { prisma } from '../lib/prisma.ts';
import type { AuthRequest } from '../middleware/authMiddleware.ts';

const VALID_TYPES = new Set(['INCOME', 'EXPENSE', 'TRANSFER']);
const VALID_INTERVALS = new Set(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);

function parseNormalizedDate(input: unknown): Date | null {
  if (typeof input !== 'string' || !input.trim()) {
    return null;
  }
  const raw = input.trim();
  const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]);
    const day = Number(ymdMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return date;
    }
    return null;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
      12,
      0,
      0,
      0
    )
  );
}

function buildTransactionWhere(userId: number, query: AuthRequest['query']): Prisma.TransactionWhereInput {
  const {
    month,
    year,
    startDate,
    endDate,
    type,
    categoryId,
    accountId,
    minAmount,
    maxAmount,
    search,
  } = query;
  const where: Prisma.TransactionWhereInput = { userId };
  const andConditions: Prisma.TransactionWhereInput[] = [];

  // Explicit startDate / endDate range takes precedence over month/year
  if (
    (typeof startDate === 'string' && startDate.trim()) ||
    (typeof endDate === 'string' && endDate.trim())
  ) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (typeof startDate === 'string' && startDate.trim()) {
      const start = parseNormalizedDate(startDate);
      if (start) {
        dateFilter.gte = new Date(
          Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 0, 0, 0, 0)
        );
      }
    }
    if (typeof endDate === 'string' && endDate.trim()) {
      const end = parseNormalizedDate(endDate);
      if (end) {
        dateFilter.lte = new Date(
          Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 23, 59, 59, 999)
        );
      }
    }
    if (Object.keys(dateFilter).length > 0) {
      where.date = dateFilter;
    }
  } else if (month || year) {
    if (month !== 'all') {
      const now = new Date();
      const y = year ? Number(year) : now.getUTCFullYear();
      const m = month ? Number(month) : null;
      if (Number.isInteger(y) && y >= 1970 && y <= 2100) {
        if (m && Number.isInteger(m) && m >= 1 && m <= 12) {
          where.date = {
            gte: new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0)),
            lt: new Date(Date.UTC(y, m, 1, 0, 0, 0, 0)),
          };
        } else if (!month) {
          where.date = {
            gte: new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0)),
            lt: new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0, 0)),
          };
        }
      }
    } else if (year && year !== 'all') {
      const y = Number(year);
      if (Number.isInteger(y) && y >= 1970 && y <= 2100) {
        where.date = {
          gte: new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0)),
          lt: new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0, 0)),
        };
      }
    }
  }

  if (typeof type === 'string' && VALID_TYPES.has(type.toUpperCase())) {
    where.type = type.toUpperCase();
  }

  if (typeof categoryId === 'string' && categoryId !== 'all' && categoryId !== '') {
    const parsedCat = Number(categoryId);
    if (Number.isInteger(parsedCat) && parsedCat > 0) {
      where.categoryId = parsedCat;
    }
  }

  if (typeof accountId === 'string' && accountId !== 'all' && accountId !== '') {
    const parsedAcc = Number(accountId);
    if (Number.isInteger(parsedAcc) && parsedAcc > 0) {
      andConditions.push({ OR: [{ accountId: parsedAcc }, { toAccountId: parsedAcc }] });
    }
  }

  // Dedicated Amount Range Filter (minAmount / maxAmount)
  const amountFilter: Prisma.FloatFilter = {};
  if (typeof minAmount === 'string' && minAmount.trim() !== '') {
    const parsedMin = Number(minAmount.replace(/,/g, '').trim());
    if (Number.isFinite(parsedMin) && parsedMin >= 0) {
      amountFilter.gte = Math.round(parsedMin * 100) / 100;
    }
  }
  if (typeof maxAmount === 'string' && maxAmount.trim() !== '') {
    const parsedMax = Number(maxAmount.replace(/,/g, '').trim());
    if (Number.isFinite(parsedMax) && parsedMax >= 0) {
      amountFilter.lte = Math.round(parsedMax * 100) / 100;
    }
  }
  if (Object.keys(amountFilter).length > 0) {
    where.amount = amountFilter;
  }

  // Global search: matches merchant/title, notes, category, wallet, exact/range amount, or YYYY-MM-DD date
  if (typeof search === 'string' && search.trim()) {
    const q = search.trim();
    const searchOr: Prisma.TransactionWhereInput[] = [
      { title: { contains: q } },
      { notes: { contains: q } },
      { category: { is: { name: { contains: q } } } },
      { account: { name: { contains: q } } },
      { toAccount: { is: { name: { contains: q } } } },
    ];

    // Match numeric amount queries (e.g. "3000", "Rs 1,500.50", "$45", ">1000", "<500", "500-2000")
    const rangeMatch = /^\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*-\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*$/.exec(q);
    const cmpMatch = /^\s*(>=|<=|>|<)\s*(?:Rs\.?|PKR|USD|EUR|GBP|\$|€|£)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*$/i.exec(q);
    const strippedNumeric = q.replace(/^(?:Rs\.?|PKR|USD|EUR|GBP|\$|€|£)\s*/i, '').replace(/,/g, '').trim();

    if (rangeMatch) {
      const low = Number(rangeMatch[1].replace(/,/g, ''));
      const high = Number(rangeMatch[2].replace(/,/g, ''));
      if (Number.isFinite(low) && Number.isFinite(high) && low <= high) {
        searchOr.push({ amount: { gte: low, lte: high } });
      }
    } else if (cmpMatch) {
      const op = cmpMatch[1];
      const val = Number(cmpMatch[2].replace(/,/g, ''));
      if (Number.isFinite(val)) {
        if (op === '>') searchOr.push({ amount: { gt: val } });
        else if (op === '>=') searchOr.push({ amount: { gte: val } });
        else if (op === '<') searchOr.push({ amount: { lt: val } });
        else if (op === '<=') searchOr.push({ amount: { lte: val } });
      }
    } else if (/^\d+(?:\.\d{1,2})?$/.test(strippedNumeric)) {
      const numVal = Number(strippedNumeric);
      if (Number.isFinite(numVal) && numVal > 0 && numVal <= 1_000_000_000_000) {
        searchOr.push({ amount: { gte: numVal - 0.005, lte: numVal + 0.005 } });
      }
    }

    // Match ISO date (YYYY-MM-DD) or month (YYYY-MM) typed into global search bar
    const exactYmd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(q);
    const exactYm = /^(\d{4})-(\d{2})$/.exec(q);
    if (exactYmd) {
      const d = parseNormalizedDate(q);
      if (d) {
        searchOr.push({
          date: {
            gte: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)),
            lte: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999)),
          },
        });
      }
    } else if (exactYm) {
      const yy = Number(exactYm[1]);
      const mm = Number(exactYm[2]);
      if (yy >= 1970 && yy <= 2100 && mm >= 1 && mm <= 12) {
        searchOr.push({
          date: {
            gte: new Date(Date.UTC(yy, mm - 1, 1, 0, 0, 0, 0)),
            lt: new Date(Date.UTC(yy, mm, 1, 0, 0, 0, 0)),
          },
        });
      }
    }

    andConditions.push({ OR: searchOr });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  return where;
}

async function adjustAccountBalance(
  tx: Prisma.TransactionClient,
  accountId: number,
  delta: number
): Promise<void> {
  const account = await tx.account.findUnique({
    where: { id: accountId },
    select: { balance: true },
  });
  if (!account) return;
  const nextCents = Math.round(account.balance * 100) + Math.round(delta * 100);
  await tx.account.update({
    where: { id: accountId },
    data: { balance: Math.round(nextCents) / 100 },
  });
}

async function applyBalanceDelta(
  tx: Prisma.TransactionClient,
  params: {
    type: string;
    amount: number;
    accountId: number;
    toAccountId: number | null;
    direction: 1 | -1;
  }
): Promise<void> {
  const { type, amount, accountId, toAccountId, direction } = params;

  if (type === 'INCOME') {
    await adjustAccountBalance(tx, accountId, amount * direction);
  } else if (type === 'EXPENSE') {
    await adjustAccountBalance(tx, accountId, -amount * direction);
  } else if (type === 'TRANSFER') {
    await adjustAccountBalance(tx, accountId, -amount * direction);
    if (toAccountId) {
      await adjustAccountBalance(tx, toAccountId, amount * direction);
    }
  }
}

const TRANSACTION_INCLUDE = {
  category: true,
  account: true,
  toAccount: true,
} as const;

export async function getTransactions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const where = buildTransactionWhere(userId, req.query);

    const sortByRaw = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'date';
    const sortOrderRaw =
      typeof req.query.sortOrder === 'string' && req.query.sortOrder.toLowerCase() === 'asc'
        ? 'asc'
        : 'desc';

    const orderBy: Prisma.TransactionOrderByWithRelationInput[] =
      sortByRaw === 'amount'
        ? [{ amount: sortOrderRaw }, { date: 'desc' }]
        : sortByRaw === 'title'
          ? [{ title: sortOrderRaw }, { date: 'desc' }]
          : [{ date: sortOrderRaw }, { createdAt: 'desc' }];

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 15));
    const skip = (page - 1) * limit;

    const [total, transactions] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: TRANSACTION_INCLUDE,
      }),
    ]);

    res.json({
      transactions,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to load transactions.' });
  }
}

export async function createTransaction(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const {
      title,
      amount,
      type,
      date,
      notes,
      categoryId,
      accountId,
      toAccountId,
      isRecurring,
      recurringInterval,
    } = req.body as {
      title?: string;
      amount?: number | string;
      type?: string;
      date?: string;
      notes?: string | null;
      categoryId?: number | string | null;
      accountId?: number | string;
      toAccountId?: number | string | null;
      isRecurring?: boolean;
      recurringInterval?: string | null;
    };

    const trimmedTitle = typeof title === 'string' ? title.trim() : '';
    const numericAmount = Math.round(Number(amount) * 100) / 100;
    const normalizedType = typeof type === 'string' ? type.trim().toUpperCase() : '';
    const parsedDate = parseNormalizedDate(date);
    const parsedAccountId = Number(accountId);
    const parsedToAccountId = toAccountId ? Number(toAccountId) : null;
    const parsedCategoryId = categoryId ? Number(categoryId) : null;
    const trimmedNotes = typeof notes === 'string' && notes.trim() ? notes.trim() : null;
    const recurring = Boolean(isRecurring);
    const interval =
      recurring &&
      typeof recurringInterval === 'string' &&
      VALID_INTERVALS.has(recurringInterval.toUpperCase())
        ? recurringInterval.toUpperCase()
        : recurring
          ? 'MONTHLY'
          : null;

    if (!trimmedTitle || trimmedTitle.length > 100) {
      res.status(400).json({ error: 'Title is required (max 100 characters).' });
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 1_000_000_000_000) {
      res.status(400).json({ error: 'Amount must be a positive number within valid limits.' });
      return;
    }
    if (!VALID_TYPES.has(normalizedType)) {
      res.status(400).json({ error: 'Type must be INCOME, EXPENSE, or TRANSFER.' });
      return;
    }
    if (!parsedDate) {
      res.status(400).json({ error: 'Please provide a valid date.' });
      return;
    }
    if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
      res.status(400).json({ error: 'Please select a valid source wallet.' });
      return;
    }

    const sourceAccount = await prisma.account.findFirst({
      where: { id: parsedAccountId, userId },
    });
    if (!sourceAccount) {
      res.status(404).json({ error: 'Source wallet not found.' });
      return;
    }

    if (normalizedType === 'TRANSFER') {
      if (!parsedToAccountId || !Number.isInteger(parsedToAccountId)) {
        res.status(400).json({ error: 'Please select a destination wallet for transfer.' });
        return;
      }
      if (parsedToAccountId === parsedAccountId) {
        res.status(400).json({ error: 'Source and destination wallets must be different.' });
        return;
      }
      const destAccount = await prisma.account.findFirst({
        where: { id: parsedToAccountId, userId },
      });
      if (!destAccount) {
        res.status(404).json({ error: 'Destination wallet not found.' });
        return;
      }
    } else {
      if (!parsedCategoryId || !Number.isInteger(parsedCategoryId)) {
        res.status(400).json({ error: 'Please select a category.' });
        return;
      }
      const category = await prisma.category.findFirst({
        where: { id: parsedCategoryId, userId },
      });
      if (!category) {
        res.status(404).json({ error: 'Selected category was not found.' });
        return;
      }
      if (category.type !== normalizedType) {
        res.status(400).json({
          error: `Category "${category.name}" is for ${category.type.toLowerCase()} transactions.`,
        });
        return;
      }
    }

    const transaction = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          title: trimmedTitle,
          amount: numericAmount,
          type: normalizedType,
          date: parsedDate,
          notes: trimmedNotes,
          isRecurring: recurring,
          recurringInterval: interval,
          categoryId: normalizedType === 'TRANSFER' ? null : parsedCategoryId,
          accountId: parsedAccountId,
          toAccountId: normalizedType === 'TRANSFER' ? parsedToAccountId : null,
          userId,
        },
        include: TRANSACTION_INCLUDE,
      });

      await applyBalanceDelta(tx, {
        type: normalizedType,
        amount: numericAmount,
        accountId: parsedAccountId,
        toAccountId: normalizedType === 'TRANSFER' ? parsedToAccountId : null,
        direction: 1,
      });

      return created;
    });

    res.status(201).json({ transaction });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ error: 'Failed to create transaction.' });
  }
}

export async function updateTransaction(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const transactionId = Number(req.params.id);

    if (!Number.isInteger(transactionId) || transactionId <= 0) {
      res.status(400).json({ error: 'Invalid transaction ID.' });
      return;
    }

    const existing = await prisma.transaction.findFirst({
      where: { id: transactionId, userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }

    const {
      title,
      amount,
      type,
      date,
      notes,
      categoryId,
      accountId,
      toAccountId,
      isRecurring,
      recurringInterval,
    } = req.body as {
      title?: string;
      amount?: number | string;
      type?: string;
      date?: string;
      notes?: string | null;
      categoryId?: number | string | null;
      accountId?: number | string;
      toAccountId?: number | string | null;
      isRecurring?: boolean;
      recurringInterval?: string | null;
    };

    const nextTitle = title !== undefined ? String(title).trim() : existing.title;
    const nextAmount =
      amount !== undefined
        ? Math.round(Number(amount) * 100) / 100
        : existing.amount;
    const nextType =
      type !== undefined ? String(type).trim().toUpperCase() : existing.type;
    const nextDate = date !== undefined ? parseNormalizedDate(date) : existing.date;
    const nextAccountId =
      accountId !== undefined ? Number(accountId) : existing.accountId;
    const nextToAccountId =
      nextType === 'TRANSFER'
        ? toAccountId !== undefined
          ? toAccountId
            ? Number(toAccountId)
            : null
          : existing.toAccountId
        : null;
    const nextCategoryId =
      nextType === 'TRANSFER'
        ? null
        : categoryId !== undefined
          ? categoryId
            ? Number(categoryId)
            : null
          : existing.categoryId;
    const nextNotes =
      notes !== undefined
        ? typeof notes === 'string' && notes.trim()
          ? notes.trim()
          : null
        : existing.notes;
    const nextRecurring =
      isRecurring !== undefined ? Boolean(isRecurring) : existing.isRecurring;
    const nextInterval = nextRecurring
      ? recurringInterval !== undefined
        ? typeof recurringInterval === 'string' &&
          VALID_INTERVALS.has(recurringInterval.toUpperCase())
          ? recurringInterval.toUpperCase()
          : 'MONTHLY'
        : existing.recurringInterval || 'MONTHLY'
      : null;

    if (!nextTitle || nextTitle.length > 100) {
      res.status(400).json({ error: 'Title is required (max 100 characters).' });
      return;
    }
    if (!Number.isFinite(nextAmount) || nextAmount <= 0 || nextAmount > 1_000_000_000_000) {
      res.status(400).json({ error: 'Amount must be a positive number within valid limits.' });
      return;
    }
    if (!VALID_TYPES.has(nextType)) {
      res.status(400).json({ error: 'Type must be INCOME, EXPENSE, or TRANSFER.' });
      return;
    }
    if (!nextDate) {
      res.status(400).json({ error: 'Please provide a valid date.' });
      return;
    }
    if (!Number.isInteger(nextAccountId) || nextAccountId <= 0) {
      res.status(400).json({ error: 'Please select a valid source wallet.' });
      return;
    }
    if (nextType === 'TRANSFER' && (!nextToAccountId || !Number.isInteger(nextToAccountId) || nextToAccountId <= 0)) {
      res.status(400).json({ error: 'Please select a valid destination wallet for transfer.' });
      return;
    }
    if (nextType !== 'TRANSFER' && (!nextCategoryId || !Number.isInteger(nextCategoryId) || nextCategoryId <= 0)) {
      res.status(400).json({ error: 'Please select a valid category.' });
      return;
    }

    const sourceAccount = await prisma.account.findFirst({
      where: { id: nextAccountId, userId },
    });
    if (!sourceAccount) {
      res.status(404).json({ error: 'Source wallet not found.' });
      return;
    }

    if (nextType === 'TRANSFER') {
      if (!nextToAccountId || nextToAccountId === nextAccountId) {
        res.status(400).json({
          error: 'Please select a different destination wallet for transfer.',
        });
        return;
      }
      const destAccount = await prisma.account.findFirst({
        where: { id: nextToAccountId, userId },
      });
      if (!destAccount) {
        res.status(404).json({ error: 'Destination wallet not found.' });
        return;
      }
    } else {
      if (!nextCategoryId) {
        res.status(400).json({ error: 'Please select a category.' });
        return;
      }
      const category = await prisma.category.findFirst({
        where: { id: nextCategoryId, userId },
      });
      if (!category) {
        res.status(404).json({ error: 'Selected category was not found.' });
        return;
      }
      if (category.type !== nextType) {
        res.status(400).json({
          error: `Category "${category.name}" is for ${category.type.toLowerCase()} transactions.`,
        });
        return;
      }
    }

    const transaction = await prisma.$transaction(async (tx) => {
      // Reverse old balance effect
      await applyBalanceDelta(tx, {
        type: existing.type,
        amount: existing.amount,
        accountId: existing.accountId,
        toAccountId: existing.toAccountId,
        direction: -1,
      });

      const updated = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          title: nextTitle,
          amount: nextAmount,
          type: nextType,
          date: nextDate,
          notes: nextNotes,
          isRecurring: nextRecurring,
          recurringInterval: nextInterval,
          categoryId: nextCategoryId,
          accountId: nextAccountId,
          toAccountId: nextToAccountId,
        },
        include: TRANSACTION_INCLUDE,
      });

      // Apply new balance effect
      await applyBalanceDelta(tx, {
        type: nextType,
        amount: nextAmount,
        accountId: nextAccountId,
        toAccountId: nextToAccountId,
        direction: 1,
      });

      return updated;
    });

    res.json({ transaction });
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ error: 'Failed to update transaction.' });
  }
}

export async function deleteTransaction(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const transactionId = Number(req.params.id);

    if (!Number.isInteger(transactionId) || transactionId <= 0) {
      res.status(400).json({ error: 'Invalid transaction ID.' });
      return;
    }

    const existing = await prisma.transaction.findFirst({
      where: { id: transactionId, userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await applyBalanceDelta(tx, {
        type: existing.type,
        amount: existing.amount,
        accountId: existing.accountId,
        toAccountId: existing.toAccountId,
        direction: -1,
      });
      await tx.transaction.delete({ where: { id: transactionId } });
    });

    res.json({ message: 'Transaction deleted.', deletedId: transactionId });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: 'Failed to delete transaction.' });
  }
}

function escapeCsvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export async function exportCsv(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const where = buildTransactionWhere(userId, req.query);

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: TRANSACTION_INCLUDE,
    });

    const header = 'date,title,type,amount,category,account,toAccount,recurring,notes';
    const lines = transactions.map((tx) => {
      const dateStr = tx.date.toISOString().slice(0, 10);
      return [
        dateStr,
        escapeCsvCell(tx.title),
        tx.type,
        tx.amount.toFixed(2),
        escapeCsvCell(tx.category?.name || (tx.type === 'TRANSFER' ? 'Transfer' : '')),
        escapeCsvCell(tx.account.name),
        escapeCsvCell(tx.toAccount?.name || ''),
        tx.isRecurring ? tx.recurringInterval || 'MONTHLY' : 'NO',
        escapeCsvCell(tx.notes || ''),
      ].join(',');
    });

    const csv = [header, ...lines].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="multi-wallet-transactions.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({ error: 'Failed to export CSV.' });
  }
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export async function importCsv(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { csvText, defaultAccountId } = req.body as {
      csvText?: string;
      defaultAccountId?: number | string;
    };

    if (typeof csvText !== 'string' || !csvText.trim()) {
      res.status(400).json({ error: 'CSV content is empty.' });
      return;
    }

    const rawLines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (rawLines.length < 2) {
      res.status(400).json({
        error: 'CSV must include a header row and at least one transaction row.',
      });
      return;
    }

    const headers = parseCsvLine(rawLines[0]).map((h) => h.toLowerCase());
    const idxDate = headers.indexOf('date');
    const idxTitle = headers.indexOf('title');
    const idxType = headers.indexOf('type');
    const idxAmount = headers.indexOf('amount');
    const idxCategory = headers.indexOf('category');
    const idxAccount = headers.indexOf('account');
    const idxToAccount = headers.indexOf('toaccount');
    const idxNotes = headers.indexOf('notes');

    if (idxDate === -1 || idxTitle === -1 || idxAmount === -1) {
      res.status(400).json({
        error: 'CSV header must include at least: date, title, amount (optional: type, category, account, toAccount, notes).',
      });
      return;
    }

    const [accounts, categories] = await Promise.all([
      prisma.account.findMany({ where: { userId } }),
      prisma.category.findMany({ where: { userId } }),
    ]);

    if (accounts.length === 0) {
      res.status(400).json({ error: 'Please create at least one wallet before importing.' });
      return;
    }

    const fallbackAccount =
      (defaultAccountId
        ? accounts.find((a) => a.id === Number(defaultAccountId))
        : undefined) || accounts[0];

    let importedCount = 0;

    await prisma.$transaction(async (tx) => {
      const catCache = new Map<string, number>();
      for (const c of categories) {
        catCache.set(`${c.type}:${c.name.toLowerCase()}`, c.id);
      }

      for (let i = 1; i < rawLines.length; i++) {
        const cols = parseCsvLine(rawLines[i]);
        const dateVal = parseNormalizedDate(cols[idxDate]);
        const titleVal = (cols[idxTitle] || '').trim();
        const rawAmount = Number((cols[idxAmount] || '').replace(/[^0-9.-]/g, ''));
        const rawType =
          idxType !== -1 && cols[idxType]
            ? cols[idxType].trim().toUpperCase()
            : 'EXPENSE';
        const absAmount = Math.round(Math.abs(rawAmount) * 100) / 100;

        if (!dateVal || !titleVal || !Number.isFinite(absAmount) || absAmount <= 0 || absAmount > 1_000_000_000_000) {
          continue;
        }

        const accName = idxAccount !== -1 ? (cols[idxAccount] || '').toLowerCase() : '';
        const matchedAccount =
          accounts.find((a) => a.name.toLowerCase() === accName) || fallbackAccount;

        const toAccName = idxToAccount !== -1 ? (cols[idxToAccount] || '').toLowerCase() : '';
        const matchedToAccount = toAccName
          ? accounts.find((a) => a.name.toLowerCase() === toAccName && a.id !== matchedAccount.id)
          : undefined;

        const txType =
          rawType === 'TRANSFER' && matchedToAccount
            ? 'TRANSFER'
            : rawType === 'INCOME'
              ? 'INCOME'
              : 'EXPENSE';

        let categoryId: number | null = null;
        if (txType !== 'TRANSFER') {
          const catName =
            idxCategory !== -1 && cols[idxCategory]
              ? cols[idxCategory].trim()
              : txType === 'INCOME'
                ? 'Salary'
                : 'Shopping';

          const cacheKey = `${txType}:${catName.toLowerCase()}`;
          categoryId = catCache.get(cacheKey) ?? null;
          if (!categoryId) {
            const createdCat = await tx.category.create({
              data: {
                name: catName.slice(0, 40),
                type: txType,
                color: txType === 'INCOME' ? '#059669' : '#4F46E5',
                icon: 'Tag',
                userId,
              },
            });
            categoryId = createdCat.id;
            catCache.set(cacheKey, categoryId);
          }
        }

        const notesVal = idxNotes !== -1 && cols[idxNotes] ? cols[idxNotes].trim() : null;

        await tx.transaction.create({
          data: {
            title: titleVal.slice(0, 100),
            amount: absAmount,
            type: txType,
            date: dateVal,
            notes: notesVal,
            isRecurring: false,
            categoryId,
            accountId: matchedAccount.id,
            toAccountId: txType === 'TRANSFER' ? matchedToAccount!.id : null,
            userId,
          },
        });

        await applyBalanceDelta(tx, {
          type: txType,
          amount: absAmount,
          accountId: matchedAccount.id,
          toAccountId: txType === 'TRANSFER' ? matchedToAccount!.id : null,
          direction: 1,
        });

        importedCount++;
      }
    });

    if (importedCount === 0) {
      res.status(400).json({ error: 'No valid transaction rows were found in the CSV.' });
      return;
    }

    res.status(201).json({
      message: `Successfully imported ${importedCount} transaction(s).`,
      importedCount,
    });
  } catch (error) {
    console.error('Import CSV error:', error);
    res.status(500).json({ error: 'Failed to import CSV transactions.' });
  }
}
