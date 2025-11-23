// Payroll postings logic: aggregate payslips of a period into accounting Transactions
// and finalize a balanced JournalEntry.
// Assumptions v1:
// - All employees considered "national" for account selection (use *_NATIONAL codes).
// - Employer & employee CNSS credited to same liability account (CNSS).
// - ONEM & INPP employer contributions credited to their liability accounts (433200 / 433100).
// - Net salary credited to NET_PAY (422000) account.
// - Benefits in kind (AEN) treated as expense (BENEFIT_IN_KIND) with corresponding credit to NET_PAY (if liquidative later) – currently none in engine v1.
// - Sequence for journal number handled by journal.finalizeBatchToJournal via nextSequence.
// - Uses newly added TransactionKind enums.

import prisma from '../prisma.js';
import { finalizeBatchToJournal, computeDebitCredit } from '../journal.js';

async function getNatExpCostCenters(tx) {
  const centers = await tx.costCenter.findMany({
    where: { code: { in: ['NAT', 'EXP'] } },
    select: { id: true, code: true },
  });
  const map = new Map(centers.map(c => [c.code, c.id]));
  return { NAT: map.get('NAT') || null, EXP: map.get('EXP') || null };
}

function toNumber(x) { return x?.toNumber?.() ?? Number(x ?? 0) ?? 0; }
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

function distributeAndRound(allocationMap, targetTotal) {
  const entries = Array.from(allocationMap.entries()); // [ [key, weight], ... ]
  const rounded = [];
  const weightSum = entries.reduce((s, [, v]) => s + (v || 0), 0);
  if (weightSum === 0 || targetTotal === 0) {
    return entries.map(([k]) => [k, 0]);
  }
  let sumRounded = 0;
  for (let i = 0; i < entries.length; i++) {
    const [key, weight] = entries[i];
    const ratio = weight / weightSum;
    const r = i < entries.length - 1 ? round2(targetTotal * ratio) : round2(targetTotal - sumRounded);
    if (i < entries.length - 1) sumRounded += r;
    rounded.push([key, r]);
  }
  return rounded; // [ [key, roundedAmount], ... ]
}

function mergeAllocations(...maps) {
  const res = new Map();
  for (const m of maps) {
    for (const [k, v] of m.entries()) {
      res.set(k, (res.get(k) || 0) + v);
    }
  }
  return res;
}

async function fetchPayrollAccounts(tx) {
  const mappings = await tx.payrollAccountMapping.findMany({ where: { active: true } });
  const index = Object.fromEntries(mappings.map(m => [m.code, m]));
  // Helper to resolve to accountId via accountNumber if needed
  async function resolve(code) {
    const m = index[code];
    if (!m) throw new Error(`Missing payroll account mapping for code ${code}`);
    if (m.accountId) return m.accountId;
    if (!m.accountNumber) throw new Error(`Mapping ${code} missing accountNumber`);
    let acc = await tx.account.findFirst({ where: { number: m.accountNumber } });
    if (!acc) {
      // Auto-create missing account for payroll usage
      acc = await tx.account.create({ data: { number: m.accountNumber, label: m.label || code } });
    }
    return acc.id;
  }
  return {
    wagesSalary: await resolve('WAGES_NATIONAL_SALARIES'),
    wagesBonus: await resolve('WAGES_NATIONAL_BONUS'),
    employerSocial: await resolve('EMPLOYER_CONTRIB_NATIONAL'),
    netPay: await resolve('NET_PAY'),
    cnss: await resolve('CNSS'),
    inpp: await resolve('INPP'),
    onem: await resolve('ONEM'),
    payeTax: await resolve('PAYE_TAX'),
    benefitInKind: index['BENEFIT_IN_KIND'] ? await resolve('BENEFIT_IN_KIND') : null,
    transferRevenue: index['TRANSFER_REVENUE'] ? await resolve('TRANSFER_REVENUE') : null,
  };
}

// Internal posting logic executed within an existing prisma.$transaction block.
export async function postPayrollPeriodTx(tx, periodId) {
  const period = await tx.payrollPeriod.findUnique({
    where: { id: periodId },
    include: {
      payslips: {
        include: {
          lines: true,
          costCenterAllocations: true,
          employee: { select: { id: true, isExpat: true } },
        },
      },
    },
  });
  if (!period) throw new Error('Payroll period not found');
  if (period.status !== 'LOCKED') throw new Error('Period must be LOCKED before posting');
  if (!period.payslips.length) throw new Error('No payslips to post');

    const accounts = await fetchPayrollAccounts(tx);
    const natExp = await getNatExpCostCenters(tx);

    // Preload cost allocations for employees in this period
    const employeeIds = Array.from(new Set(period.payslips.map(p => p.employeeId))).filter(Boolean);
    const empAllocs = employeeIds.length
      ? await tx.employeeCostAllocation.findMany({ where: { employeeId: { in: employeeIds } } })
      : [];
    const allocByEmp = new Map();
    for (const a of empAllocs) {
      if (!allocByEmp.has(a.employeeId)) allocByEmp.set(a.employeeId, []);
      allocByEmp.get(a.employeeId).push({ costCenterId: a.costCenterId, percent: toNumber(a.percent) });
    }
    // Snapshot allocations: prefer payslip snapshots if present
    function getAllocations(ps) {
      if (ps.costCenterAllocations?.length) {
        return ps.costCenterAllocations.map(a => ({ costCenterId: a.costCenterId, percent: toNumber(a.percent) }));
      }
      return allocByEmp.get(ps.employeeId) || [];
    }

    // Aggregate totals
  let baseSalaryTotal = 0;
  let bonusTotal = 0;
  // Allocation maps: key costCenterId|null -> amount
    const baseAlloc = new Map();
    const bonusAlloc = new Map();
    let employerSocialTotal = 0; // CNSS_ER + ONEM + INPP
    let cnssEmpTotal = 0; // employee CNSS (negative line amount -> add absolute)
    let cnssErTotal = 0; // employer CNSS
    let onemTotal = 0;
    let inppTotal = 0;
    let iprTotal = 0; // employee tax withholding
    let netTotal = 0;
    let benefitInKindTotal = 0;

    for (const ps of period.payslips) {
      netTotal += Number(ps.netAmount?.toNumber?.() ?? ps.netAmount);
      for (const l of ps.lines) {
        const amt = Number(l.amount?.toNumber?.() ?? l.amount);
        switch (l.code) {
          case 'BASE':
            if (amt > 0) {
              baseSalaryTotal += amt;
              const alloc = getAllocations(ps);
              if (alloc && alloc.length) {
                let acc = 0;
                for (let i = 0; i < alloc.length; i++) {
                  const p = alloc[i];
                  const part = i < alloc.length - 1 ? (amt * toNumber(p.percent)) : (amt - acc);
                  const key = p.costCenterId || null;
                  baseAlloc.set(key, (baseAlloc.get(key) || 0) + part);
                  acc += part;
                }
              } else {
                const fallbackCc = ps.employee?.isExpat ? (natExp.EXP || null) : (natExp.NAT || null);
                const key = fallbackCc || null;
                baseAlloc.set(key, (baseAlloc.get(key) || 0) + amt);
              }
            }
            break;
          default:
            // Treat any PRIME kind (PRIME/VAR+/OT) as bonus expense
            if (l.kind === 'PRIME' && amt > 0) {
              bonusTotal += amt;
              const alloc = getAllocations(ps);
              if (alloc && alloc.length) {
                let acc = 0;
                for (let i = 0; i < alloc.length; i++) {
                  const p = alloc[i];
                  const part = i < alloc.length - 1 ? (amt * toNumber(p.percent)) : (amt - acc);
                  const key = p.costCenterId || null;
                  bonusAlloc.set(key, (bonusAlloc.get(key) || 0) + part);
                  acc += part;
                }
              } else {
                const fallbackCc = ps.employee?.isExpat ? (natExp.EXP || null) : (natExp.NAT || null);
                const key = fallbackCc || null;
                bonusAlloc.set(key, (bonusAlloc.get(key) || 0) + amt);
              }
              break;
            }
            switch (l.code) {
              case 'CNSS_EMP':
                cnssEmpTotal += Math.abs(amt);
                break;
              case 'CNSS_ER':
                cnssErTotal += amt; employerSocialTotal += amt; break;
              case 'ONEM':
                onemTotal += amt; employerSocialTotal += amt; break;
              case 'INPP':
                inppTotal += amt; employerSocialTotal += amt; break;
              case 'IPR':
                iprTotal += Math.abs(amt);
                break;
              case 'AEN':
                benefitInKindTotal += (amt > 0 ? amt : 0);
                break;
              default:
                break;
            }
            break;
        }
      }
    }

    // Build transaction rows (balanced double-entry)
    const txnData = [];
    const today = new Date();
    const common = { date: today, description: `Paie ${period.month}/${period.year}` };

    if (netTotal <= 0) {
      throw new Error(`Aggregated net salary <= 0 (netTotal=${netTotal.toFixed(2)}). Review payslip tax/withholding calculations before posting.`);
    }

    // Debits: gross salary split between salary and bonus (simple proportion: all base to wagesSalary, primes to wagesBonus)
    // For simplicity v1 we aggregated gross; we can't separate base/bonus amounts now => use wagesSalary for total gross.
    if (baseSalaryTotal > 0) {
      const rounded = distributeAndRound(baseAlloc, round2(baseSalaryTotal));
      for (const [ccId, amt] of rounded) {
        if (amt <= 0) continue;
        txnData.push({ ...common, amount: amt, direction: 'DEBIT', kind: 'SALARY_EXPENSE', accountId: accounts.wagesSalary, costCenterId: ccId || undefined });
      }
    }
    if (bonusTotal > 0) {
      const roundedB = distributeAndRound(bonusAlloc, round2(bonusTotal));
      for (const [ccId, amt] of roundedB) {
        if (amt <= 0) continue;
        txnData.push({ ...common, amount: amt, direction: 'DEBIT', kind: 'SALARY_BONUS_EXPENSE', accountId: accounts.wagesBonus, costCenterId: ccId || undefined });
      }
    }
    if (benefitInKindTotal > 0 && accounts.benefitInKind) {
      txnData.push({ ...common, amount: benefitInKindTotal, direction: 'DEBIT', kind: 'BENEFIT_IN_KIND_EXPENSE', accountId: accounts.benefitInKind });
    }
    if (benefitInKindTotal > 0 && !accounts.benefitInKind) {
      throw new Error('AEN present in payslips but BENEFIT_IN_KIND mapping is missing. Please add a PayrollAccountMapping with code=BENEFIT_IN_KIND.');
    }
    if (employerSocialTotal > 0) {
      const socialAlloc = mergeAllocations(baseAlloc, bonusAlloc);
      if (socialAlloc.size) {
        const roundedES = distributeAndRound(socialAlloc, round2(employerSocialTotal));
        for (const [ccId, amt] of roundedES) {
          if (amt <= 0) continue;
          txnData.push({ ...common, amount: amt, direction: 'DEBIT', kind: 'EMPLOYER_SOCIAL_EXPENSE', accountId: accounts.employerSocial, costCenterId: ccId || undefined });
        }
      } else {
        txnData.push({ ...common, amount: employerSocialTotal, direction: 'DEBIT', kind: 'EMPLOYER_SOCIAL_EXPENSE', accountId: accounts.employerSocial });
      }
    }

    // Credits liabilities
    if (netTotal > 0) {
      txnData.push({ ...common, amount: netTotal, direction: 'CREDIT', kind: 'WAGES_PAYABLE', accountId: accounts.netPay });
    }
    if (cnssEmpTotal > 0) {
      txnData.push({ ...common, amount: cnssEmpTotal, direction: 'CREDIT', kind: 'EMPLOYEE_SOCIAL_WITHHOLDING', accountId: accounts.cnss });
    }
    if (cnssErTotal > 0) {
      txnData.push({ ...common, amount: cnssErTotal, direction: 'CREDIT', kind: 'EMPLOYER_SOCIAL_WITHHOLDING', accountId: accounts.cnss });
    }
    if (onemTotal > 0) {
      txnData.push({ ...common, amount: onemTotal, direction: 'CREDIT', kind: 'OTHER_PAYROLL_LIABILITY', accountId: accounts.onem });
    }
    if (inppTotal > 0) {
      txnData.push({ ...common, amount: inppTotal, direction: 'CREDIT', kind: 'OTHER_PAYROLL_LIABILITY', accountId: accounts.inpp });
    }
    if (iprTotal > 0) {
      txnData.push({ ...common, amount: iprTotal, direction: 'CREDIT', kind: 'INCOME_TAX_WITHHOLDING', accountId: accounts.payeTax });
    }

    // Persist transactions
    const createdTxns = [];
    for (const data of txnData) {
      createdTxns.push(await tx.transaction.create({ data }));
    }

    // Finalize journal
    const journal = await finalizeBatchToJournal(tx, {
      sourceType: 'PAYROLL',
      sourceId: period.id,
      date: today,
      description: `Journal paie ${period.month}/${period.year}`,
      transactions: createdTxns,
    });

    // Mark period posted
    await tx.payrollPeriod.update({ where: { id: period.id }, data: { status: 'POSTED', postedAt: new Date() } });

  const { debit, credit } = computeDebitCredit(createdTxns);
  return { journal, transactions: createdTxns, debit, credit };
}

// Convenience wrapper for cases where we want to post outside an existing transaction.
export async function postPayrollPeriod(periodId) {
  return prisma.$transaction(async (tx) => postPayrollPeriodTx(tx, periodId));
}

// Reverse a posted payroll journal and set period back to LOCKED
export async function reversePayrollPeriodTx(tx, periodId, actor = null) {
  const period = await tx.payrollPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new Error('Payroll period not found');
  if (period.status !== 'POSTED') throw new Error('Period must be POSTED to reverse');
  const je = await tx.journalEntry.findFirst({ where: { sourceType: 'PAYROLL', sourceId: period.id }, orderBy: { date: 'desc' } });
  if (!je) throw new Error('No payroll journal found to reverse');
  const origTxns = await tx.transaction.findMany({ where: { journalEntryId: je.id } });
  if (!origTxns.length) throw new Error('Original journal has no transactions');

  const today = new Date();
  const reversed = [];
  const desc = `Annulation paie ${period.month}/${period.year} (reversal ${je.number})`;
  for (const t of origTxns) {
    const amount = Number(t.amount?.toNumber?.() ?? t.amount);
    const direction = t.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT';
    reversed.push(await tx.transaction.create({
      data: {
        date: today,
        description: desc,
        amount,
        direction,
        kind: t.kind,
        accountId: t.accountId,
        costCenterId: t.costCenterId || undefined,
      }
    }));
  }

  const reversalJournal = await finalizeBatchToJournal(tx, {
    sourceType: 'PAYROLL',
    sourceId: period.id,
    date: today,
    description: desc,
    transactions: reversed,
  });

  await tx.payrollPeriod.update({ where: { id: period.id }, data: { status: 'LOCKED', postedAt: null } });
  // Audit log
  await tx.auditLog.create({
    data: {
      entityType: 'PAYROLL_PERIOD',
      entityId: period.id,
      action: 'REVERSE',
      data: {
        periodRef: period.ref,
        originalJournal: je.number,
        reversalJournal: reversalJournal.number,
        reversedCount: reversed.length,
        actor
      }
    }
  });
  const { debit, credit } = computeDebitCredit(reversed);
  return { journal: reversalJournal, reversedCount: reversed.length, debit, credit };
}

export async function reversePayrollPeriod(periodId, actor = null) {
  return prisma.$transaction(async (tx) => reversePayrollPeriodTx(tx, periodId, actor));
}
