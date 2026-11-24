import 'dotenv/config';
import cors from 'cors';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDatabaseSchema } from './server/lib/dbBootstrap.ts';
import { seedDemoAccount } from './server/lib/defaults.ts';
import { prisma } from './server/lib/prisma.ts';
import { errorHandler, notFoundHandler } from './server/middleware/errorMiddleware.ts';
import accountRoutes from './server/routes/accountRoutes.ts';
import aiRoutes from './server/routes/aiRoutes.ts';
import analyticsRoutes from './server/routes/analyticsRoutes.ts';
import authRoutes from './server/routes/authRoutes.ts';
import budgetRoutes from './server/routes/budgetRoutes.ts';
import categoryRoutes from './simport 'dotenv/config';
import cors from 'cors';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDatabaseSchema } from './server/lib/dbBootstrap.js';
import { seedDemoAccount } from './server/lib/defaults.js';
import { prisma } from './server/lib/prisma.js';
import { errorHandler, notFoundHandler } from './server/middleware/errorMiddleware.js';
import accountRoutes from './server/routes/accountRoutes.js';
import aiRoutes from './server/routes/aiRoutes.js';
import analyticsRoutes from './server/routes/analyticsRoutes.js';
import authRoutes from './server/routes/authRoutes.js';
import budgetRoutes from './server/routes/budgetRoutes.js';
import categoryRoutes from './server/routes/categoryRoutes.js';
import goalRoutes from './server/routes/goalRoutes.js';
import transactionRoutes from './server/routes/transactionRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);

app.use('/api', notFoundHandler);
app.use(errorHandler);

let dbInitialized = false;
async function initDb() {
  if (dbInitialized) return;
  try {
    await prisma.$connect();
    await ensureDatabaseSchema();
    await seedDemoAccount(false);
    dbInitialized = true;
  } catch (error) {
    console.error('Database initialization warning:', error);
  }
}

if (!process.env.VERCEL) {
  (async () => {
    if (!isProd) {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.resolve(__dirname, 'dist');
      if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
        app.get('*', (_req: Request, res: Response) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      }
    }
    await initDb();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Multi-Wallet server listening on http://0.0.0:${PORT}`);
    });
  })();
} else {
  initDb();
}

export default app;
erver/routes/categoryRoutes.ts';
import goalRoutes from './server/routes/goalRoutes.ts';
import transactionRoutes from './server/routes/transactionRoutes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.set('trust proxy', 1);
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/accounts', accountRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/transactions', transactionRoutes);
  app.use('/api/budgets', budgetRoutes);
  app.use('/api/goals', goalRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/ai', aiRoutes);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  try {
    await prisma.$connect();
    await ensureDatabaseSchema();
    await seedDemoAccount(false);
  } catch (error) {
    console.error('Database initialization warning:', error);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Multi-Wallet server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
