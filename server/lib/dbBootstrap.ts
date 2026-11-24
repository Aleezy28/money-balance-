import { prisma } from './prisma.ts';

interface PragmaTableInfoRow {
  name: string;
}

export async function ensureDatabaseSchema(): Promise<void> {
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
  await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
  await prisma.$executeRawUnsafe('PRAGMA busy_timeout = 5000;');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "password" TEXT NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'PKR',
      "language" TEXT NOT NULL DEFAULT 'en',
      "preferences" TEXT,
      "monthlyIncomeGoal" REAL NOT NULL DEFAULT 0,
      "emailVerified" BOOLEAN NOT NULL DEFAULT false,
      "verificationCode" TEXT,
      "verificationCodeExpires" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");'
  );

  // Safely add new User columns if migrating an older SQLite DB
  const userColumns = await prisma.$queryRawUnsafe<PragmaTableInfoRow[]>(
    'PRAGMA table_info("User");'
  );
  const colNames = new Set(userColumns.map((c) => c.name));

  if (!colNames.has('emailVerified')) {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT true;'
    );
  }
  if (!colNames.has('verificationCode')) {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "User" ADD COLUMN "verificationCode" TEXT;'
    );
  }
  if (!colNames.has('verificationCodeExpires')) {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "User" ADD COLUMN "verificationCodeExpires" DATETIME;'
    );
  }
  if (!colNames.has('language')) {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "User" ADD COLUMN "language" TEXT NOT NULL DEFAULT \'en\';'
    );
  }
  if (!colNames.has('preferences')) {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "User" ADD COLUMN "preferences" TEXT;'
    );
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Account" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "balance" REAL NOT NULL DEFAULT 0,
      "color" TEXT NOT NULL DEFAULT '#0F766E',
      "userId" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");'
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Category" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "color" TEXT NOT NULL DEFAULT '#0F766E',
      "icon" TEXT NOT NULL DEFAULT 'Tag',
      "userId" INTEGER NOT NULL,
      CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Category_userId_idx" ON "Category"("userId");'
  );
  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "Category_userId_name_type_key" ON "Category"("userId", "name", "type");'
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Transaction" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "title" TEXT NOT NULL,
      "amount" REAL NOT NULL,
      "type" TEXT NOT NULL,
      "date" DATETIME NOT NULL,
      "notes" TEXT,
      "isRecurring" BOOLEAN NOT NULL DEFAULT false,
      "recurringInterval" TEXT,
      "categoryId" INTEGER,
      "accountId" INTEGER NOT NULL,
      "toAccountId" INTEGER,
      "userId" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "Transaction_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Transaction_userId_date_idx" ON "Transaction"("userId", "date");'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Transaction_accountId_idx" ON "Transaction"("accountId");'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Transaction_categoryId_idx" ON "Transaction"("categoryId");'
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Budget" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "amount" REAL NOT NULL,
      "month" INTEGER NOT NULL,
      "year" INTEGER NOT NULL,
      "categoryId" INTEGER NOT NULL,
      "userId" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Budget_userId_month_year_idx" ON "Budget"("userId", "month", "year");'
  );
  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "Budget_userId_categoryId_month_year_key" ON "Budget"("userId", "categoryId", "month", "year");'
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SavingsGoal" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "title" TEXT NOT NULL,
      "targetAmount" REAL NOT NULL,
      "currentAmount" REAL NOT NULL DEFAULT 0,
      "deadline" DATETIME,
      "color" TEXT NOT NULL DEFAULT '#0F766E',
      "userId" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SavingsGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "SavingsGoal_userId_idx" ON "SavingsGoal"("userId");'
  );
}
