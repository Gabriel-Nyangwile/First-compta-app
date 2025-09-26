import prisma from './prisma.js';

/**
 * Récupère (et crée si besoin) les comptes systèmes nécessaires.
 * - Compte client : fourni via client.accountId
 * - Compte TVA collectée : 445700 (T.V.A. Collectée)
 * - Compte TVA déductible : 445660 (T.V.A. Déductible)
 */
export async function getSystemAccounts() {
  // TVA collectée (ventes)
  let vatAccount = await prisma.account.findFirst({ where: { number: '445700' } });
  if (!vatAccount) {
    vatAccount = await prisma.account.create({
      data: {
        number: '445700',
        label: 'T.V.A. Collectée',
        description: 'Compte système auto-créé pour TVA collectée sur ventes'
      }
    });
  }
  // TVA déductible (achats)
  let vatDeductibleAccount = await prisma.account.findFirst({ where: { number: '445660' } });
  if (!vatDeductibleAccount) {
    vatDeductibleAccount = await prisma.account.create({
      data: {
        number: '445660',
        label: 'T.V.A. Déductible',
        description: 'Compte système auto-créé pour TVA déductible sur achats'
      }
    });
  }
  return { vatAccount, vatDeductibleAccount };
}
