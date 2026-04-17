import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes('--apply');
  const users = await prisma.user.findMany({
    where: { companyId: { not: null } },
    select: {
      id: true,
      email: true,
      role: true,
      companyId: true,
      isActive: true,
    },
    orderBy: { email: 'asc' },
  });

  const memberships = users.map((user) => ({
    companyId: user.companyId,
    userId: user.id,
    role: user.role,
    isDefault: true,
    isActive: user.isActive,
  }));

  console.log(`mode: ${apply ? 'apply' : 'dry-run'}`);
  console.log(`memberships.toSync: ${memberships.length}`);

  for (const item of memberships.slice(0, 10)) {
    console.log(`- ${item.userId} ${item.companyId} ${item.role}`);
  }

  if (!apply) {
    return;
  }

  for (const item of memberships) {
    await prisma.$executeRaw`
      INSERT INTO "CompanyMembership" ("id", "companyId", "userId", "role", "isDefault", "isActive", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${item.companyId}, ${item.userId}, ${item.role}::"UserRole", ${item.isDefault}, ${item.isActive}, NOW(), NOW())
      ON CONFLICT ("companyId", "userId")
      DO UPDATE SET
        "role" = EXCLUDED."role",
        "isDefault" = EXCLUDED."isDefault",
        "isActive" = EXCLUDED."isActive",
        "updatedAt" = NOW()
    `;
  }

  console.log('\nMembership backfill applied.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
