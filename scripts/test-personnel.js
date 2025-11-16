import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const counts = await Promise.all([
      prisma.position.count().catch(e => ({ error: e.message })),
      prisma.contract.count().catch(e => ({ error: e.message })),
      prisma.employee.count().catch(e => ({ error: e.message })),
      prisma.employeeHistory.count().catch(e => ({ error: e.message })),
    ]);
    console.log('Position count or error:', counts[0]);
    console.log('Contract count or error:', counts[1]);
    console.log('Employee count or error:', counts[2]);
    console.log('EmployeeHistory count or error:', counts[3]);
  } finally {
    await prisma.$disconnect();
  }
}
main();