import type { CurrencyCode } from '../types';

const CURRENCY_CONFIG: Record<
  CurrencyCode,
  { locale: string; symbol: string; decimals: number }
> = {
  PKR: { locale: 'en-PK', symbol: 'Rs', decimals: 0 },
  USD: { locale: 'en-US', symbol: '$', decimals: 2 },
  EUR: { locale: 'en-IE', symbol: '€', decimals: 2 },
  GBP: { locale: 'en-GB', symbol: '£', decimals: 2 },
};

export function formatCurrency(
  value: number,
  currency: CurrencyCode = 'PKR',
  showSign = false
): string {
  const safe = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(safe);
  const cfg = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.PKR;

  const formattedNumber = new Intl.NumberFormat(cfg.locale, {
    minimumFractionDigits: currency === 'PKR' && abs % 1 === 0 ? 0 : cfg.decimals,
    maximumFractionDigits: 2,
  }).format(abs);

  const prefix = safe < 0 ? '-' : showSign && safe > 0 ? '+' : '';
  return currency === 'PKR'
    ? `${prefix}Rs ${formattedNumber}`
    : `${prefix}${cfg.symbol}${formattedNumber}`;
}

export function formatCompactCurrency(
  value: number,
  currency: CurrencyCode = 'PKR'
): string {
  const safe = Number.isFinite(value) ? value : 0;
  const cfg = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.PKR;
  const sym = currency === 'PKR' ? 'Rs ' : cfg.symbol;

  if (Math.abs(safe) >= 1_000_000) {
    return `${sym}${(safe / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(safe) >= 1_000) {
    return `${sym}${Math.round(safe / 1_000)}k`;
  }
  return `${sym}${Math.round(safe)}`;
}

export function formatDisplayDate(isoDate: string): string {
  if (!isoDate) return '';
  const ymd = isoDate.slice(0, 10);
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const utcDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utcDate);
}

export function formatDayHeading(isoDate: string): string {
  if (!isoDate) return '';
  const ymd = isoDate.slice(0, 10);
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const utcDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utcDate);
}

export function formatLoggedTime(isoTimestamp?: string | null): string {
  if (!isoTimestamp) return '';
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

export function toInputDateValue(isoDate?: string | null): string {
  if (isoDate && isoDate.length >= 10) {
    return isoDate.slice(0, 10);
  }
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];
