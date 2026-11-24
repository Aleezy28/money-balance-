import 'dotenv/config';
import { seedDemoAccount } from '../server/lib/defaults.ts';
import { prisma } from '../server/lib/prisma.ts';

async function main() {
  console.log('Seeding ClearLedger 20-feature demo database...');
  await seedDemoAccount(true);

  const demoUser = await prisma.user.findUnique({
    where: { email: 'demo@example.com' },
    include: {
      _count: {
        select: {
          accounts: true,
          categories: true,
          transactions: true,
          budgets: true,
          savingsGoals: true,
        },
      },
    },
  });

  console.log(
    `Seeded ${demoUser?.email} (${demoUser?.currency}): ` +
      `${demoUser?._count.accounts} wallets, ` +
      `${demoUser?._count.categories} categories, ` +
      `${demoUser?._count.transactions} transactions, ` +
      `${demoUser?._count.budgets} budgets, ` +
      `${demoUser?._count.savingsGoals} goals.`
  );
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
