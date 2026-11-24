import type { Account, Category, TransactionType } from '../types';
import { toInputDateValue } from './formatCurrency';

export interface ParsedVoiceTransaction {
  type?: TransactionType;
  amount?: string;
  title?: string;
  categoryId?: string;
  accountId?: string;
  toAccountId?: string;
  date?: string;
  notes?: string;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  food: ['food', 'coffee', 'tea', 'lunch', 'dinner', 'breakfast', 'snack', 'snacks', 'grocery', 'groceries', 'restaurant', 'cafe', 'pizza', 'burger', 'meal', 'biryani', 'bakery'],
  transport: ['uber', 'careem', 'indrive', 'taxi', 'cab', 'bus', 'train', 'fuel', 'petrol', 'gas', 'diesel', 'parking', 'toll', 'metro', 'flight', 'ride', 'commute'],
  shopping: ['shop', 'shopping', 'clothes', 'shirt', 'shoes', 'amazon', 'daraz', 'mall', 'electronics', 'gadget', 'accessories', 'gift'],
  bills: ['bill', 'bills', 'electricity', 'water', 'internet', 'wifi', 'phone', 'mobile', 'utility', 'utilities', 'netflix', 'spotify', 'subscription', 'recharge'],
  rent: ['rent', 'housing', 'apartment', 'maintenance', 'lease'],
  health: ['doctor', 'medicine', 'pharmacy', 'hospital', 'clinic', 'gym', 'health', 'dental'],
  entertainment: ['movie', 'cinema', 'game', 'games', 'concert', 'netflix', 'outing', 'trip'],
  salary: ['salary', 'paycheck', 'payroll', 'wages', 'stipend'],
  freelance: ['freelance', 'client', 'project', 'consulting', 'invoice', 'bonus', 'contract'],
  investment: ['dividend', 'interest', 'stock', 'profit', 'return', 'investment'],
};

function toTitleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function extractDate(lower: string): string | undefined {
  if (/\byesterday\b/.test(lower)) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return toInputDateValue(d.toISOString());
  }
  if (/\btoday\b/.test(lower)) {
    return toInputDateValue();
  }
  return undefined;
}

function extractAmount(lower: string): { amount?: string; rawMatch?: string } {
  // Match forms like "1,250.50", "5k", "2.5k", "500"
  const match = lower.match(/\b(\d{1,3}(?:,\d{3})+|\d+(?:\.\d{1,2})?)\s*(k|thousand)?\b/i);
  if (!match) return {};
  const numeric = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0) return {};
  const multiplier = match[2] ? 1000 : 1;
  const total = Math.round(numeric * multiplier * 100) / 100;
  return {
    amount: String(total),
    rawMatch: match[0],
  };
}

function findMatchingAccount(
  lower: string,
  accounts: Account[],
  excludeId?: string
): Account | undefined {
  const candidates = accounts.filter((a) => String(a.id) !== excludeId);
  // Exact or substring name match
  for (const acc of candidates) {
    const accLower = acc.name.toLowerCase();
    const firstWord = accLower.split(/\s+/)[0];
    if (lower.includes(accLower) || (firstWord.length >= 3 && lower.includes(firstWord))) {
      return acc;
    }
  }
  // Type fallback
  if (/\bcash\b/.test(lower)) {
    return candidates.find((a) => a.type === 'CASH');
  }
  if (/\bbank\b/.test(lower)) {
    return candidates.find((a) => a.type === 'BANK');
  }
  if (/\bcard\b|\bcredit\b|\bdebit\b/.test(lower)) {
    return candidates.find((a) => a.type === 'CARD');
  }
  if (/\bmobile\b|\bwallet\b|\bjazzcash\b|\beasypaisa\b|\bsadapay\b|\bnayapay\b/.test(lower)) {
    return candidates.find((a) => a.type === 'MOBILE_WALLET');
  }
  return undefined;
}

export function parseVoiceTransaction(
  transcript: string,
  accounts: Account[],
  categories: Category[]
): ParsedVoiceTransaction {
  const cleaned = transcript.trim();
  if (!cleaned) return {};

  const lower = cleaned.toLowerCase();
  const result: ParsedVoiceTransaction = {};

  // 1. Detect Transaction Type
  const transferCue = /\b(transfer|transferred|move|moved|send|sent)\b/.test(lower) &&
    /\bto\b/.test(lower);
  const incomeCue = /\b(received|earned|got paid|income|salary|paycheck|deposit|deposited|refund|bonus|freelance payment)\b/.test(
    lower
  );

  let detectedType: TransactionType = 'EXPENSE';
  if (transferCue) {
    detectedType = 'TRANSFER';
  } else if (incomeCue) {
    detectedType = 'INCOME';
  }
  result.type = detectedType;

  // 2. Extract Amount
  const { amount, rawMatch } = extractAmount(lower);
  if (amount) {
    result.amount = amount;
  }

  // 3. Extract Relative Date
  const parsedDate = extractDate(lower);
  if (parsedDate) {
    result.date = parsedDate;
  }

  // 4. Match Wallets / Accounts
  if (detectedType === 'TRANSFER') {
    const fromMatch = lower.match(/\bfrom\s+([a-z0-9\s]+?)(?:\s+to\b|$)/i);
    const toMatch = lower.match(/\bto\s+([a-z0-9\s]+?)(?:\s+(?:on|for|today|yesterday)\b|$)/i);

    const fromAcc = fromMatch
      ? findMatchingAccount(fromMatch[1], accounts)
      : findMatchingAccount(lower, accounts);
    if (fromAcc) {
      result.accountId = String(fromAcc.id);
    }

    const toAcc = toMatch
      ? findMatchingAccount(toMatch[1], accounts, result.accountId)
      : findMatchingAccount(lower, accounts, result.accountId);
    if (toAcc) {
      result.toAccountId = String(toAcc.id);
    }
  } else {
    const matchedAccount = findMatchingAccount(lower, accounts);
    if (matchedAccount) {
      result.accountId = String(matchedAccount.id);
    }
  }

  // 5. Match Category (when not TRANSFER)
  if (detectedType !== 'TRANSFER') {
    const typeCategories = categories.filter((c) => c.type === detectedType);
    // Direct category name match
    let matchedCat = typeCategories.find((c) => {
      const catLower = c.name.toLowerCase();
      return (
        lower.includes(catLower) ||
        catLower.split(/[\s&/]+/).some((part) => part.length >= 3 && lower.includes(part))
      );
    });

    // Keyword group fallback
    if (!matchedCat) {
      for (const [, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        const hitKeyword = keywords.find((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(lower));
        if (hitKeyword) {
          matchedCat = typeCategories.find((c) => {
            const name = c.name.toLowerCase();
            return keywords.some((kw) => name.includes(kw));
          });
          if (matchedCat) break;
        }
      }
    }

    if (matchedCat) {
      result.categoryId = String(matchedCat.id);
    }
  }

  // 6. Build Clean Title from remaining descriptive phrase
  let titleCandidate = cleaned;
  if (rawMatch) {
    titleCandidate = titleCandidate.replace(new RegExp(rawMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ');
  }

  // Remove matched account names from title if phrased with from/into/via/using
  for (const acc of accounts) {
    const escaped = acc.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    titleCandidate = titleCandidate.replace(
      new RegExp(`\\b(?:from|into|to|via|using|in|with)?\\s*${escaped}\\b`, 'gi'),
      ' '
    );
  }

  titleCandidate = titleCandidate
    .replace(/\b(spent|paid|bought|purchase|purchased|add|log|logged|record|recorded|received|earned|got|transferred|transfer|move|moved|rupees|rupee|pkr|rs|usd|dollars|dollar|eur|euros|gbp|pounds|today|yesterday|from|into|using|via|account|wallet)\b/gi, ' ')
    .replace(/^\s*(for|on|at|to|in|my|the|a|an)\b\s*/gi, '')
    .replace(/\b(for|on|at|to|in|my|the|a|an)\s*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (titleCandidate.length >= 2) {
    result.title = toTitleCase(titleCandidate).slice(0, 100);
  } else if (detectedType === 'TRANSFER') {
    result.title = 'Wallet Transfer';
  }

  result.notes = `Voice log: "${cleaned}"`.slice(0, 300);

  return result;
}
