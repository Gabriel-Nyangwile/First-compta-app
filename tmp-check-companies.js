import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

(async () => {
  try {
    const companies = await prisma.company.findMany();
    console.log('Nombre de sociétés:', companies.length);
    companies.forEach(c => console.log(`  - ${c.name} (${c.siret})`));
  } catch (e) {
    console.log('Erreur:', e.message);
  }
  await prisma.$disconnect();
})();
