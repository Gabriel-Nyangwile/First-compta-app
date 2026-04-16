// Purge complète paie : reverse journaux paie, supprime règlements/demo et remet à zéro périodes + séquences.
// Dry-run par défaut : lancez avec DRY_RUN=false pour exécuter.
import prisma from '../src/lib/prisma.js';
import { PAYROLL_SETTLEMENT_CONFIGS } from '../src/lib/payroll/settlement-config.js';

async function main() {
  const dry = (process.env.DRY_RUN ?? 'true').toLowerCase() !== 'false';
  console.log(`Purge paie :: dryRun=${dry}`);

  // 1) Reverse journaux paie (periods POSTED)
  const posted = await prisma.payrollPeriod.findMany({ where: { status: 'POSTED' }, select: { id: true, ref: true } });
  if (posted.length) console.log(`Periods POSTED à reverser: ${posted.map(p => p.ref).join(', ')}`);
  if (!dry) {
    for (const p of posted) {
      const je = await prisma.journalEntry.findFirst({ where: { sourceType: 'PAYROLL', sourceId: p.id }, orderBy: { date: 'desc' } });
      if (!je) continue;
      const txns = await prisma.transaction.findMany({ where: { journalEntryId: je.id } });
      // Reverser manuellement (mimique de reversePayrollPeriodTx sans audit)
      const today = new Date();
      const reversed = [];
      for (const t of txns) {
        reversed.push(await prisma.transaction.create({
          data: {
            date: today,
            description: `Reverse purge paie ${p.ref} (${je.number})`,
            amount: Number(t.amount?.toNumber?.() ?? t.amount),
            direction: t.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT',
            kind: t.kind,
            accountId: t.accountId,
            costCenterId: t.costCenterId || undefined,
          }
        }));
      }
      if (reversed.length) {
        await prisma.journalEntry.create({
          data: {
            sourceType: 'PAYROLL',
            sourceId: p.id,
            date: today,
            description: `Reverse purge paie ${p.ref}`,
            transactions: { connect: reversed.map(r => ({ id: r.id })) },
          }
        });
      }
      await prisma.payrollPeriod.update({ where: { id: p.id }, data: { status: 'LOCKED', postedAt: null } });
    }
  }

  // 2) Supprimer règlements paie (voucherRef PAYSET-/PAYCNSS-/PAYONEM-/PAYINPP-/PAYIPR-)
  const settlementPrefixes = Object.values(PAYROLL_SETTLEMENT_CONFIGS).map((config) => config.prefix);
  const allPayrollJournals = await prisma.journalEntry.findMany({
    where: { sourceType: 'PAYROLL' },
    select: { id: true, number: true, voucherRef: true, description: true },
  });
  const settlementJes = allPayrollJournals.filter((journal) => settlementPrefixes.some((prefix) => journal.voucherRef?.startsWith(prefix) || journal.description?.includes(prefix)));
  console.log(`Journaux règlements à supprimer: ${settlementJes.length}`);
  if (!dry) {
    const txnIds = (await prisma.transaction.findMany({ where: { journalEntryId: { in: settlementJes.map(j => j.id) } }, select: { id: true } }))
      .map(t => t.id);
    if (txnIds.length) await prisma.transaction.deleteMany({ where: { id: { in: txnIds } } });
    if (settlementJes.length) await prisma.journalEntry.deleteMany({ where: { id: { in: settlementJes.map(j => j.id) } } });
  }

  // 3) Purge données paie (ordre FK)
  const steps = [
    ['payrollVariable', {}],
    ['employeeAttendance', {}],
    ['payslipCostAllocation', {}],
    ['payslipLine', {}],
    ['payslip', {}],
    ['payrollPeriod', {}],
  ];
  for (const [model, where] of steps) {
    const count = await prisma[model].count({ where });
    console.log(`Delete ${model}: ${count}`);
    if (!dry && count) await prisma[model].deleteMany({ where });
  }

  // 4) (optionnel) auditLog paie
  const auditCount = await prisma.auditLog.count({ where: { entityType: 'PAYROLL_PERIOD' } });
  console.log(`Delete auditLog PAYROLL_PERIOD: ${auditCount}`);
  if (!dry && auditCount) await prisma.auditLog.deleteMany({ where: { entityType: 'PAYROLL_PERIOD' } });

  // 5) Reset séquences PP- et règlements paie
  const seqNames = ['PAYROLL_PERIOD', ...Object.values(PAYROLL_SETTLEMENT_CONFIGS).map((config) => config.sequenceName)];
  for (const name of seqNames) {
    if (dry) { console.log(`Would reset sequence ${name} -> 0`); continue; }
    await prisma.sequence.upsert({ where: { name }, update: { value: 0 }, create: { name, value: 0 } });
    console.log(`Sequence ${name} reset to 0`);
  }

  console.log('Terminé');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => prisma.$disconnect());
