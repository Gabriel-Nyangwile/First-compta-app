import prisma from './prisma.js';

function accountWhere(number, companyId) {
  return companyId ? { number, companyId } : { number };
}

function accountData(number, label, description, companyId) {
  const data = { number, label, description };
  if (companyId) data.companyId = companyId;
  return data;
}

/**
 * Recupere (et cree si besoin) les comptes systemes necessaires.
 * - Compte client : fourni via client.accountId
 * - Compte TVA collectee : 445700 (T.V.A. Collectee)
 * - Compte TVA deductible : 445660 (T.V.A. Deductible)
 */
export async function getSystemAccounts(companyId = null) {
  let vatAccount = await prisma.account.findFirst({ where: accountWhere('445700', companyId) });
  if (!vatAccount) {
    vatAccount = await prisma.account.create({
      data: accountData(
        '445700',
        'T.V.A. Collectee',
        'Compte systeme auto-cree pour TVA collectee sur ventes',
        companyId
      )
    });
  }

  let vatDeductibleAccount = await prisma.account.findFirst({ where: accountWhere('445660', companyId) });
  if (!vatDeductibleAccount) {
    vatDeductibleAccount = await prisma.account.create({
      data: accountData(
        '445660',
        'T.V.A. Deductible',
        'Compte systeme auto-cree pour TVA deductible sur achats',
        companyId
      )
    });
  }

  return { vatAccount, vatDeductibleAccount };
}
