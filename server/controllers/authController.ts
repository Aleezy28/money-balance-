import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { seedDefaultUserEntities } from '../lib/defaults.ts';
import { prisma } from '../lib/prisma.ts';
import {
  JWT_SECRET,
  SESSION_COOKIE_NAME,
  type AuthRequest,
} from '../middleware/authMiddleware.ts';

const VALID_CURRENCIES = new Set(['PKR', 'USD', 'EUR', 'GBP']);
const VALID_LANGUAGES = new Set(['en', 'roman_ur', 'ur', 'es']);
const VERIFICATION_TTL_MS = 15 * 60 * 1000;

export interface FeaturePreferences {
  voiceQuickAdd: boolean;
  budgetAlerts: boolean;
  savingsGoals: boolean;
  accountingModule: boolean;
  pdfReports: boolean;
  overdraftWarning: boolean;
  keyboardShortcuts: boolean;
}

export const DEFAULT_FEATURE_PREFERENCES: FeaturePreferences = {
  voiceQuickAdd: true,
  budgetAlerts: true,
  savingsGoals: true,
  accountingModule: true,
  pdfReports: true,
  overdraftWarning: true,
  keyboardShortcuts: true,
};

function parseFeaturePreferences(raw: string | null | undefined): FeaturePreferences {
  if (!raw) return { ...DEFAULT_FEATURE_PREFERENCES };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      voiceQuickAdd:
        typeof parsed.voiceQuickAdd === 'boolean'
          ? parsed.voiceQuickAdd
          : DEFAULT_FEATURE_PREFERENCES.voiceQuickAdd,
      budgetAlerts:
        typeof parsed.budgetAlerts === 'boolean'
          ? parsed.budgetAlerts
          : DEFAULT_FEATURE_PREFERENCES.budgetAlerts,
      savingsGoals:
        typeof parsed.savingsGoals === 'boolean'
          ? parsed.savingsGoals
          : DEFAULT_FEATURE_PREFERENCES.savingsGoals,
      accountingModule:
        typeof parsed.accountingModule === 'boolean'
          ? parsed.accountingModule
          : DEFAULT_FEATURE_PREFERENCES.accountingModule,
      pdfReports:
        typeof parsed.pdfReports === 'boolean'
          ? parsed.pdfReports
          : DEFAULT_FEATURE_PREFERENCES.pdfReports,
      overdraftWarning:
        typeof parsed.overdraftWarning === 'boolean'
          ? parsed.overdraftWarning
          : DEFAULT_FEATURE_PREFERENCES.overdraftWarning,
      keyboardShortcuts:
        typeof parsed.keyboardShortcuts === 'boolean'
          ? parsed.keyboardShortcuts
          : DEFAULT_FEATURE_PREFERENCES.keyboardShortcuts,
    };
  } catch {
    return { ...DEFAULT_FEATURE_PREFERENCES };
  }
}

function serializeUser<
  T extends {
    id: number;
    name: string;
    email: string;
    currency: string;
    language: string;
    preferences: string | null;
    monthlyIncomeGoal: number;
    emailVerified: boolean;
    createdAt: Date;
  },
>(u: T) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    currency: u.currency,
    language: VALID_LANGUAGES.has(u.language) ? u.language : 'en',
    featurePreferences: parseFeaturePreferences(u.preferences),
    monthlyIncomeGoal: u.monthlyIncomeGoal,
    emailVerified: u.emailVerified,
    createdAt: u.createdAt,
  };
}

function signToken(userId: number, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
}

function generateVerificationCode(): string {
  return String(crypto.randomInt(100000, 999999));
}

function hashVerificationCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim()).digest('hex');
}

function isHttpsRequest(req: Request): boolean {
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return req.secure || proto.includes('https');
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const encoded = encodeURIComponent(token);
  const parts = [
    `${SESSION_COOKIE_NAME}=${encoded}`,
    'Path=/',
    'HttpOnly',
    'Max-Age=604800',
  ];
  if (isHttpsRequest(req)) {
    parts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(req: Request, res: Response): void {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
  ];
  if (isHttpsRequest(req)) {
    parts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  currency: true,
  language: true,
  preferences: true,
  monthlyIncomeGoal: true,
  emailVerified: true,
  createdAt: true,
} as const;

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password, currency } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      currency?: string;
    };

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const rawPassword = typeof password === 'string' ? password : '';
    const preferredCurrency =
      typeof currency === 'string' && VALID_CURRENCIES.has(currency.toUpperCase())
        ? currency.toUpperCase()
        : 'PKR';

    if (!trimmedName || trimmedName.length < 2) {
      res.status(400).json({ error: 'Name must be at least 2 characters long.' });
      return;
    }

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }

    if (rawPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const plainCode = generateVerificationCode();
    const hashedCode = hashVerificationCode(plainCode);
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: trimmedName,
          email: normalizedEmail,
          password: hashedPassword,
          currency: preferredCurrency,
          monthlyIncomeGoal: 0,
          emailVerified: false,
          verificationCode: hashedCode,
          verificationCodeExpires: expiresAt,
        },
        select: USER_SELECT,
      });

      await seedDefaultUserEntities(tx, createdUser.id);
      return createdUser;
    });

    res.status(201).json({
      requiresVerification: true,
      email: user.email,
      user: serializeUser(user),
      verificationPreviewCode: plainCode,
      message: 'Account created! Enter the 6-digit verification code to verify your email and sign in.',
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const rawPassword = typeof password === 'string' ? password : '';

    if (!normalizedEmail || !rawPassword) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const isValid = await bcrypt.compare(rawPassword, user.password);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (!user.emailVerified) {
      const plainCode = generateVerificationCode();
      const hashedCode = hashVerificationCode(plainCode);
      const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          verificationCode: hashedCode,
          verificationCodeExpires: expiresAt,
        },
      });

      res.status(403).json({
        error: 'Email verification required before signing in.',
        requiresVerification: true,
        email: user.email,
        verificationPreviewCode: plainCode,
      });
      return;
    }

    const token = signToken(user.id, user.email);
    setSessionCookie(req, res, token);

    res.json({
      token,
      user: serializeUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to log in. Please try again.' });
  }
}

export async function sendVerification(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const rawPassword = typeof password === 'string' ? password : '';

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    if (!rawPassword) {
      res.status(400).json({ error: 'Please enter your account password to request a verification code.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !(await bcrypt.compare(rawPassword, user.password))) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (user.emailVerified) {
      res.json({
        alreadyVerified: true,
        email: user.email,
        message: 'This email is already verified. You can sign in directly.',
      });
      return;
    }

    const plainCode = generateVerificationCode();
    const hashedCode = hashVerificationCode(plainCode);
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationCode: hashedCode,
        verificationCodeExpires: expiresAt,
      },
    });

    res.json({
      alreadyVerified: false,
      email: user.email,
      verificationPreviewCode: plainCode,
      message: 'A 6-digit verification code has been generated for your email.',
    });
  } catch (error) {
    console.error('Send verification error:', error);
    res.status(500).json({ error: 'Failed to send verification code.' });
  }
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  try {
    const { email, code } = req.body as {
      email?: string;
      code?: string;
    };

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanCode = typeof code === 'string' ? code.trim() : '';

    if (!normalizedEmail || !/^\d{6}$/.test(cleanCode)) {
      res.status(400).json({ error: 'Enter your email and the 6-digit verification code.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      res.status(404).json({ error: 'Account not found for that email.' });
      return;
    }

    if (user.emailVerified) {
      res.status(400).json({ error: 'Email is already verified. Please sign in with your password.' });
      return;
    }

    if (!user.verificationCode || !user.verificationCodeExpires) {
      res.status(400).json({ error: 'No active verification code found. Request a new code.' });
      return;
    }

    if (user.verificationCodeExpires.getTime() < Date.now()) {
      res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
      return;
    }

    const providedHash = Buffer.from(hashVerificationCode(cleanCode), 'hex');
    const storedHash = Buffer.from(user.verificationCode, 'hex');

    if (
      providedHash.length !== storedHash.length ||
      !crypto.timingSafeEqual(providedHash, storedHash)
    ) {
      res.status(401).json({ error: 'Incorrect verification code. Please check and try again.' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationCode: null,
        verificationCodeExpires: null,
      },
      select: USER_SELECT,
    });

    const token = signToken(updatedUser.id, updatedUser.email);
    setSessionCookie(req, res, token);

    res.json({
      token,
      user: serializeUser(updatedUser),
      message: 'Email verified successfully!',
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Failed to verify email.' });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  clearSessionCookie(req, res);
  res.json({ message: 'Signed out successfully.' });
}

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT,
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.json({ user: serializeUser(user) });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ error: 'Failed to load profile.' });
  }
}

export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { name, currency, monthlyIncomeGoal, language, featurePreferences } =
      req.body as {
        name?: string;
        currency?: string;
        monthlyIncomeGoal?: number | string;
        language?: string;
        featurePreferences?: Partial<FeaturePreferences>;
      };

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const updateData: {
      name?: string;
      currency?: string;
      monthlyIncomeGoal?: number;
      language?: string;
      preferences?: string;
    } = {};

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (trimmed.length < 2) {
        res.status(400).json({ error: 'Name must be at least 2 characters long.' });
        return;
      }
      updateData.name = trimmed;
    }

    if (currency !== undefined) {
      const upper = String(currency).trim().toUpperCase();
      if (!VALID_CURRENCIES.has(upper)) {
        res.status(400).json({ error: 'Currency must be PKR, USD, EUR, or GBP.' });
        return;
      }
      updateData.currency = upper;
    }

    if (language !== undefined) {
      const normalizedLang = String(language).trim().toLowerCase();
      if (!VALID_LANGUAGES.has(normalizedLang)) {
        res.status(400).json({
          error: 'Language must be en, roman_ur, ur, or es.',
        });
        return;
      }
      updateData.language = normalizedLang;
    }

    if (featurePreferences && typeof featurePreferences === 'object') {
      const merged = parseFeaturePreferences(existing?.preferences);
      for (const key of Object.keys(DEFAULT_FEATURE_PREFERENCES) as Array<
        keyof FeaturePreferences
      >) {
        if (typeof featurePreferences[key] === 'boolean') {
          merged[key] = featurePreferences[key] as boolean;
        }
      }
      updateData.preferences = JSON.stringify(merged);
    }

    if (monthlyIncomeGoal !== undefined) {
      const goal = Number(monthlyIncomeGoal);
      if (!Number.isFinite(goal) || goal < 0) {
        res.status(400).json({ error: 'Monthly income goal must be 0 or greater.' });
        return;
      }
      updateData.monthlyIncomeGoal = Math.round(goal * 100) / 100;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: USER_SELECT,
    });

    res.json({ user: serializeUser(user) });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
}

export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    const rawCurrent = typeof currentPassword === 'string' ? currentPassword : '';
    const rawNext = typeof newPassword === 'string' ? newPassword : '';

    if (!rawCurrent || !rawNext) {
      res.status(400).json({ error: 'Current password and new password are required.' });
      return;
    }

    if (rawNext.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      return;
    }

    if (rawCurrent === rawNext) {
      res.status(400).json({
        error: 'New password must be different from your current password.',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const matches = await bcrypt.compare(rawCurrent, user.password);
    if (!matches) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(rawNext, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to update password.' });
  }
}

export async function resetAccountData(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;

    await prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({ where: { userId } });
      await tx.budget.deleteMany({ where: { userId } });
      await tx.savingsGoal.deleteMany({ where: { userId } });
      await tx.category.deleteMany({ where: { userId } });
      await tx.account.deleteMany({ where: { userId } });

      await seedDefaultUserEntities(tx, userId);
    });

    res.json({ message: 'All account data has been reset to defaults.' });
  } catch (error) {
    console.error('Reset account data error:', error);
    res.status(500).json({ error: 'Failed to reset account data.' });
  }
}
