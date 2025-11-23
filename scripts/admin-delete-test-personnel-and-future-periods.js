#!/usr/bin/env node
/**
 * Suppression du personnel "Test" et des périodes de paie > Octobre 2025.
 * Usage: node scripts/admin-delete-test-personnel-and-future-periods.js [--confirm] [--purge-journal]
 * --confirm : exécute les suppressions (sinon dry-run)
 * --purge-journal : supprime aussi les écritures journal sourceType=PAYROLL liées aux périodes/payslips supprimés.
 *                   Après utilisation, exécuter un rebuild si cohérence globale souhaitée (voir rebuild-journal.js).
 *
 * Critères employés "Test" : firstName=='Test' OR lastName=='Test' OR email LIKE '%test%' OR employeeNumber LIKE '%TEST%'.
 * Périodes ciblées : (year > 2025) OU (year == 2025 AND month > 10).
 * Ordre de suppression sécurisé :
 *   - Pour les périodes: allocations (PayslipCostAllocation), lignes (PayslipLine), variables, présences, bulletins (Payslip), période (PayrollPeriod).
 *   - Pour employés Test restants (toutes périodes <= Oct 2025) : allocations employé, allocations bulletins, lignes bulletins, présences, variables, bulletins, history, employé.
 * JournalEntry PAYROLL éventuels non supprimés (garder intégrité comptable) -> ajuster si besoin.
 */
import prisma from '../src/lib/prisma.js';

async function main(){
  const confirm = process.argv.includes('--confirm');
  const purgeJournal = process.argv.includes('--purge-journal');
  console.log(confirm ? 'MODE CONFIRM (suppression effective)' : 'MODE DRY-RUN (aucune suppression)');
  if (purgeJournal) console.log('Option --purge-journal activée (écritures PAYROLL ciblées).');

  // 1. Identifier périodes futures
  const futurePeriods = await prisma.payrollPeriod.findMany({
    where: {
      OR: [
        { year: { gt: 2025 } },
        { year: 2025, month: { gt: 10 } }
      ]
    },
    select: { id: true, ref: true, month: true, year: true }
  });
  // Collecter ids
  const futurePeriodIds = futurePeriods.map(p => p.id);

  // 2. Bulletins liés aux périodes futures
  const futurePayslips = futurePeriodIds.length ? await prisma.payslip.findMany({ where: { periodId: { in: futurePeriodIds } }, select: { id: true, ref: true } }) : [];

  // 3. Employés "Test"
  const testEmployees = await prisma.employee.findMany({
    where: {
      OR: [
        { firstName: 'Test' },
        { lastName: 'Test' },
        { email: { contains: 'test', mode: 'insensitive' } },
        { employeeNumber: { contains: 'TEST' } },
      ]
    },
    select: { id: true, firstName: true, lastName: true, email: true }
  });

  // Payslips des employés test sur périodes antérieures (<= Oct 2025)
  const testEmployeeIds = testEmployees.map(e => e.id);
  const cutoffFilter = {
    OR: [
      { period: { year: { lt: 2025 } } },
      { period: { year: 2025, month: { lte: 10 } } }
    ]
  };
  const remainingTestPayslips = testEmployeeIds.length ? await prisma.payslip.findMany({
    where: { employeeId: { in: testEmployeeIds }, ...cutoffFilter },
    select: { id: true, ref: true }
  }) : [];

  // Identifiants de payslips supprimés (futurs + test employés)
  const futurePayslipIds = futurePayslips.map(p => p.id);
  const remainingTestPayslipIds = remainingTestPayslips.map(p => p.id);
  const allTargetPayslipIds = [...futurePayslipIds, ...remainingTestPayslipIds];

  // Journal entries potentiellement à purger (sourceType PAYROLL & sourceId match periodId ou payslipId)
  let payrollJournalEntries = [];
  if (purgeJournal && (futurePeriodIds.length || allTargetPayslipIds.length)) {
    payrollJournalEntries = await prisma.journalEntry.findMany({
      where: {
        sourceType: 'PAYROLL',
        OR: [
          futurePeriodIds.length ? { sourceId: { in: futurePeriodIds } } : {},
          allTargetPayslipIds.length ? { sourceId: { in: allTargetPayslipIds } } : {},
        ]
      },
      select: { id: true, number: true, sourceId: true }
    });
  }

  console.log('\nRÉSUMÉ DRY-RUN');
  console.log('Périodes futures à supprimer:', futurePeriods.length);
  futurePeriods.forEach(p => console.log(`  - Period ${p.ref} (${p.month}/${p.year})`));
  console.log('Bulletins futurs:', futurePayslips.length);
  console.log('Employés Test:', testEmployees.length);
  testEmployees.forEach(e => console.log(`  - Emp ${e.id} ${e.firstName} ${e.lastName} ${e.email || ''}`));
  console.log('Bulletins employés Test (<= Oct 2025):', remainingTestPayslips.length);
  if (purgeJournal) {
    console.log('Journal PAYROLL ciblé (potentiel):', payrollJournalEntries.length);
    payrollJournalEntries.forEach(j => console.log(`  - JRN ${j.number} sourceId=${j.sourceId}`));
  }

  if (!confirm){
    console.log('\nDry-run terminé. Ajoutez --confirm pour exécuter.');
    await prisma.$disconnect();
    return;
  }

  // 4. Suppression transactionnelle
  await prisma.$transaction(async(tx)=>{
    // Périodes futures
    if (futurePeriodIds.length){
      // allocations bulletins
      await tx.payslipCostAllocation.deleteMany({ where: { payslip: { periodId: { in: futurePeriodIds } } } });
      // lignes bulletins
      await tx.payslipLine.deleteMany({ where: { payslip: { periodId: { in: futurePeriodIds } } } });
      // variables
      await tx.payrollVariable.deleteMany({ where: { periodId: { in: futurePeriodIds } } });
      // présences
      await tx.employeeAttendance.deleteMany({ where: { periodId: { in: futurePeriodIds } } });
      // bulletins
      await tx.payslip.deleteMany({ where: { periodId: { in: futurePeriodIds } } });
      // périodes
      await tx.payrollPeriod.deleteMany({ where: { id: { in: futurePeriodIds } } });
    }

    // Employés Test (bulletins restants <= Oct 2025)
    if (testEmployeeIds.length){
      // allocations employé
      await tx.employeeCostAllocation.deleteMany({ where: { employeeId: { in: testEmployeeIds } } });
      // allocations bulletins
      await tx.payslipCostAllocation.deleteMany({ where: { payslip: { employeeId: { in: testEmployeeIds } } } });
      // lignes bulletins
      await tx.payslipLine.deleteMany({ where: { payslip: { employeeId: { in: testEmployeeIds } } } });
      // variables
      await tx.payrollVariable.deleteMany({ where: { employeeId: { in: testEmployeeIds } } });
      // présences
      await tx.employeeAttendance.deleteMany({ where: { employeeId: { in: testEmployeeIds } } });
      // bulletins
      await tx.payslip.deleteMany({ where: { employeeId: { in: testEmployeeIds } } });
      // history
      await tx.employeeHistory.deleteMany({ where: { employeeId: { in: testEmployeeIds } } });
      // employés
      await tx.employee.deleteMany({ where: { id: { in: testEmployeeIds } } });
    }

    // Purge Journal PAYROLL si demandé
    if (purgeJournal && payrollJournalEntries.length){
      const journalIds = payrollJournalEntries.map(j => j.id);
      // Supprimer d'abord transactions liées (lines)
      await tx.transaction.deleteMany({ where: { journalEntryId: { in: journalIds } } });
      await tx.journalEntry.deleteMany({ where: { id: { in: journalIds } } });
    }
  });

  console.log('\nSuppression effectuée.' + (purgeJournal ? ' (Journal PAYROLL purgé)' : ''));
  if (purgeJournal) {
    console.log('Recommandé: exécuter ensuite: node scripts/rebuild-journal.js');
  }
  await prisma.$disconnect();
}

main().catch(e => { console.error('Erreur script', e); process.exit(99); }).finally(async()=>{ await prisma.$disconnect(); });
