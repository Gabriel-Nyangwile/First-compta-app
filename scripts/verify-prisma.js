import * as pc from '@prisma/client';
const { PrismaClient, ClientCategory } = pc;

const prisma = new PrismaClient();

async function main() {
  console.log('--- Prisma connectivity smoke test ---');
  const res = await prisma.$queryRaw`SELECT 1 as one`;
  console.log('Raw query result:', res);

  // Show enum values (should reflect generated client)
  console.log('ClientCategory enum values:', Object.keys(ClientCategory));

  // Simple count queries (wrapped in try/catch in case tables not migrated yet)
  try {
    const userCount = await prisma.user.count();
    console.log('User count:', userCount);
  } catch (e) {
    console.warn('Skipped user.count (table may not exist yet):', e.message);
  }

  try {
    const mmCount = await prisma.moneyMovement.count();
    console.log('MoneyMovement count:', mmCount);
  } catch (e) {
    console.warn('Skipped moneyMovement.count (table may not match schema yet):', e.message);
  }

  console.log('Done.');
}

main()
  .catch(err => {
    console.error('FAIL:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
