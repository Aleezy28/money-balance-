import type { Response } from 'express';
import { prisma } from '../lib/prisma.ts';
import type { AuthRequest } from '../middleware/authMiddleware.ts';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';
const VALID_TYPES = new Set(['INCOME', 'EXPENSE', 'TRANSFER']);

function getGroqConfig() {
  const apiKey = process.env.GROQ_API_KEY?.trim() || '';
  const model = process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
  return { apiKey, model, configured: apiKey.length > 0 };
}

function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function getAiStatus(_req: AuthRequest, res: Response): Promise<void> {
  const { configured, model } = getGroqConfig();
  res.json({
    configured,
    provider: 'groq',
    model,
  });
}

export async function parseTransactionWithGroq(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const userId = req.userId!;
  const { apiKey, model, configured } = getGroqConfig();

  if (!configured) {
    res.status(503).json({
      error: 'GROQ_API_KEY is not configured in .env on the server.',
      configured: false,
    });
    return;
  }

  const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!rawText) {
    res.status(400).json({ error: 'Transaction description text is required.' });
    return;
  }
  if (rawText.length > 500) {
    res.status(400).json({ error: 'Input text must be 500 characters or fewer.' });
    return;
  }

  const [accounts, categories, user] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      select: { id: true, name: true, type: true },
      orderBy: { id: 'asc' },
    }),
    prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, type: true },
      orderBy: { id: 'asc' },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    }),
  ]);

  const today = getTodayIsoDate();
  const systemPrompt = [
    'You are a structured financial transaction parser for a personal expense app.',
    'The user may write in English, Roman Urdu, or Urdu/Spanish phrases.',
    `Today's date is ${today}. User currency is ${user?.currency || 'PKR'}.`,
    'Available wallets (accounts): ' + JSON.stringify(accounts),
    'Available categories: ' + JSON.stringify(categories),
    'Return ONLY a valid JSON object with exact keys:',
    '{',
    '  "type": "INCOME" | "EXPENSE" | "TRANSFER",',
    '  "title": string (short merchant/description, max 80 chars),',
    '  "amount": number | null (positive number, convert "2k" -> 2000),',
    '  "date": "YYYY-MM-DD",',
    '  "accountId": number | null (must match an id from available wallets),',
    '  "toAccountId": number | null (only for TRANSFER, different from accountId),',
    '  "categoryId": number | null (for INCOME/EXPENSE, must match category id with same type),',
    '  "notes": string | null',
    '}',
  ].join('\n');

  try {
    const groqRes = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: rawText },
        ],
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!groqRes.ok) {
      const errBody = await groqRes.text().catch(() => '');
      console.error('Groq API error:', groqRes.status, errBody.slice(0, 300));
      res.status(502).json({
        error:
          groqRes.status === 401
            ? 'Invalid GROQ_API_KEY. Please check your .env configuration.'
            : 'Groq API request failed. Please try again.',
      });
      return;
    }

    const data = (await groqRes.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      res.status(502).json({ error: 'Empty response returned from Groq API.' });
      return;
    }

    let parsedRaw: Record<string, unknown>;
    try {
      parsedRaw = JSON.parse(content) as Record<string, unknown>;
    } catch {
      res.status(502).json({ error: 'Groq returned an unreadable JSON payload.' });
      return;
    }

    const txType =
      typeof parsedRaw.type === 'string' && VALID_TYPES.has(parsedRaw.type.toUpperCase())
        ? (parsedRaw.type.toUpperCase() as 'INCOME' | 'EXPENSE' | 'TRANSFER')
        : 'EXPENSE';

    const title =
      typeof parsedRaw.title === 'string' && parsedRaw.title.trim()
        ? parsedRaw.title.trim().slice(0, 100)
        : rawText.slice(0, 100);

    const rawAmount = Number(parsedRaw.amount);
    const amount =
      Number.isFinite(rawAmount) && rawAmount > 0 && rawAmount <= 1_000_000_000
        ? String(Math.round(rawAmount * 100) / 100)
        : '';

    const rawDate = typeof parsedRaw.date === 'string' ? parsedRaw.date.trim() : '';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;

    const accountSet = new Set(accounts.map((a) => a.id));
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const reqAccountId = Number(parsedRaw.accountId);
    const accountId =
      Number.isInteger(reqAccountId) && accountSet.has(reqAccountId)
        ? String(reqAccountId)
        : accounts[0]
          ? String(accounts[0].id)
          : '';

    const reqToAccountId = Number(parsedRaw.toAccountId);
    const toAccountId =
      txType === 'TRANSFER' &&
      Number.isInteger(reqToAccountId) &&
      accountSet.has(reqToAccountId) &&
      String(reqToAccountId) !== accountId
        ? String(reqToAccountId)
        : '';

    const reqCategoryId = Number(parsedRaw.categoryId);
    const matchedCategory = Number.isInteger(reqCategoryId)
      ? categoryMap.get(reqCategoryId)
      : undefined;
    const categoryId =
      txType !== 'TRANSFER' && matchedCategory && matchedCategory.type === txType
        ? String(matchedCategory.id)
        : '';

    const notes =
      typeof parsedRaw.notes === 'string' && parsedRaw.notes.trim()
        ? parsedRaw.notes.trim().slice(0, 250)
        : '';

    res.json({
      provider: 'groq',
      model,
      parsed: {
        type: txType,
        title,
        amount,
        date,
        accountId,
        toAccountId,
        categoryId,
        notes,
      },
    });
  } catch (err) {
    console.error('Groq parse failure:', err);
    res.status(502).json({
      error: 'Could not reach Groq API. Check network connectivity and GROQ_API_KEY.',
    });
  }
}
