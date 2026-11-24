import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

if (!process.env.DATABASE_URL) {
  const prismaDir = path.resolve(process.cwd(), 'prisma');
  if (!fs.existsSync(prismaDir)) {
    fs.mkdirSync(prismaDir, { recursive: true });
  }
  const dbPath = path.join(prismaDir, 'dev.db');
  process.env.DATABASE_URL = `file:${dbPath}?connection_limit=1`;
} else if (
  process.env.DATABASE_URL.startsWith('file:') &&
  !process.env.DATABASE_URL.includes('connection_limit=')
) {
  const sep = process.env.DATABASE_URL.includes('?') ? '&' : '?';
  process.env.DATABASE_URL = `${process.env.DATABASE_URL}${sep}connection_limit=1`;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
