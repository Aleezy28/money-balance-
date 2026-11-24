import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const PROCESS_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

export const JWT_SECRET = process.env.JWT_SECRET || PROCESS_FALLBACK_SECRET;
export const SESSION_COOKIE_NAME = 'mw_session';

export interface AuthRequest extends Request {
  userId?: number;
}

interface JwtPayload {
  userId: number;
  email: string;
}

function extractTokenFromCookies(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const eqIndex = part.indexOf('=');
    if (eqIndex === -1) continue;
    const key = part.slice(0, eqIndex).trim();
    if (key === SESSION_COOKIE_NAME) {
      return decodeURIComponent(part.slice(eqIndex + 1).trim());
    }
  }
  return null;
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else {
    token = extractTokenFromCookies(req.headers.cookie) || '';
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if (!decoded || typeof decoded.userId !== 'number') {
      res.status(401).json({ error: 'Invalid session payload.' });
      return;
    }
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session token. Please log in again.' });
  }
}
