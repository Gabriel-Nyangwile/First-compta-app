// Purge complète paie : reverse journaux paie, supprime règlements/demo et remet à zéro périodes + séquences.
// Dry-run par défaut : lancez avec DRY_RUN=false pour exécuter.
import prisma from '../src/lib/prisma.js';
import { PAYROLL_SETTLEMENT_CONFIGS } from '../src/lib/payroll/settlement-config.js';
import { deleteUnreferencedEmptyJournalsByIds } from '../src/lib/journalCleanup.js';

function parseArgs(argv) {
  const args = argv.slice(2);
  const idx = args.indexOf('--companyId');
  return {
    companyId: idx >= 0 ? args[idx + 1] : (process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || null),
  };
}

async function main() {
  const { companyId } = parseArgs(process.argv);
  const dry = (process.env.DRY_RUN ?? 'true').toLowerCase() !== 'false';
  if (!companyId) throw new Error('companyId requis (--companyId ou DEFAULT_COMPANY_ID)');
  console.log(`Purge paie :: dryRun=${dry} companyId=${companyId}`);

  // 1) Reverse journaux paie (periods POSTED)
  const posted = await prisma.payrollPeriod.findMany({ where: { status: 'POSTED', companyId }, select: { id: true, ref: true, companyId: true } });
  if (posted.length) console.log(`Periods POSTED à reverser: ${posted.map(p => p.ref).join(', ')}`);
  if (!dry) {
    for (const p of posted) {
      const je = await prisma.journalEntry.findFirst({ where: { sourceType: 'PAYROLL', sourceId: p.id, companyId }, orderBy: { date: 'desc' } });
      if (!je) continue;
      const txns = await prisma.transaction.findMany({ where: { journalEntryId: je.id, companyId } });
      // Reverser manuellement (mimique de reversePayrollPeriodTx sans audit)
      const today = new Date();
      const reversed = [];
      for (const t of txns) {
        reversed.push(await prisma.transaction.create({
          data: {
            companyId,
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
            companyId,
            sourceType: 'PAYROLL',
            sourceId: p.id,
            date: today,
            description: `Reverse purge paie ${p.ref}`,
            transactions: { connect: reversed.map(r => ({ id: r.id })) },
          }
        });
      }
      await prisma.payrollPeriod.update({ where: { id: p.id, companyId }, data: { status: 'LOCKED', postedAt: null } });
    }
  }

  // 2) Supprimer règlements paie (voucherRef PAYSET-/PAYCNSS-/PAYONEM-/PAYINPP-/PAYIPR-)
  const settlementPrefixes = Object.values(PAYROLL_SETTLEMENT_CONFIGS).map((config) => config.prefix);
  const allPayrollJournals = await prisma.journalEntry.findMany({
    where: { sourceType: 'PAYROLL', companyId },
    select: { id: true, number: true, voucherRef: true, description: true },
  });
  const settlementJes = allPayrollJournals.filter((journal) => settlementPrefixes.some((prefix) => journal.voucherRef?.startsWith(prefix) || journal.description?.includes(prefix)));
  console.log(`Journaux règlements à supprimer: ${settlementJes.length}`);
  if (!dry) {
    const settlementJeIds = settlementJes.map(j => j.id);
    const txnIds = (await prisma.transaction.findMany({ where: { journalEntryId: { in: settlementJeIds }, companyId }, select: { id: true } }))
      .map(t => t.id);
    if (txnIds.length) await prisma.transaction.deleteMany({ where: { id: { in: txnIds } } });
    if (settlementJeIds.length) await deleteUnreferencedEmptyJournalsByIds(prisma, settlementJeIds, companyId);
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
    const scopedWhere = { ...where, companyId };
    const count = await prisma[model].count({ where: scopedWhere });
    console.log(`Delete ${model}: ${count}`);
    if (!dry && count) await prisma[model].deleteMany({ where: scopedWhere });
  }

  // 4) (optionnel) auditLog paie
  const auditCount = await prisma.auditLog.count({ where: { entityType: 'PAYROLL_PERIOD', companyId } });
  console.log(`Delete auditLog PAYROLL_PERIOD: ${auditCount}`);
  if (!dry && auditCount) await prisma.auditLog.deleteMany({ where: { entityType: 'PAYROLL_PERIOD', companyId } });

  // 5) Reset séquences PP- et règlements paie
  const seqNames = ['PAYROLL_PERIOD', ...Object.values(PAYROLL_SETTLEMENT_CONFIGS).map((config) => config.sequenceName)];
  for (const name of seqNames) {
    if (dry) { console.log(`Would reset sequence ${name} -> 0`); continue; }
    await prisma.sequence.upsert({
      where: { companyId_name: { companyId, name } },
      update: { value: 0 },
      create: { name, value: 0, companyId },
    });
    console.log(`Sequence ${name} reset to 0`);
  }

  console.log('Terminé');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => prisma.$disconnect());
