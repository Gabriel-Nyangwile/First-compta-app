import prisma from './prisma.js';
import { finalizeBatchToJournal } from './journal.js';
import { nextSequence } from './sequence.js';

function toNumber(x) {
  return x?.toNumber?.() ?? Number(x ?? 0) ?? 0;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

async function resolveAccountId({ accountId, accountNumber, label }, client = prisma) {
  if (accountId) return accountId;
  if (!accountNumber) throw new Error(`Missing account mapping for ${label || 'asset'}`);
  let acc = await client.account.findFirst({ where: { number: accountNumber } });
  if (!acc) {
    acc = await client.account.create({ data: { number: accountNumber, label: label || accountNumber } });
  }
  return acc.id;
}

export async function resolveCategoryAccounts(category, client = prisma) {
  return {
    asset: await resolveAccountId({
      accountId: category.assetAccountId,
      accountNumber: category.assetAccountNumber,
      label: category.assetAccount?.label || 'Asset',
    }, client),
    depreciation: await resolveAccountId({
      accountId: category.depreciationAccountId,
      accountNumber: category.depreciationAccountNumber,
      label: category.depreciationAccount?.label || 'Depreciation reserve',
    }, client),
    expense: await resolveAccountId({
      accountId: category.expenseAccountId,
      accountNumber: category.expenseAccountNumber,
      label: category.expenseAccount?.label || 'Depreciation expense',
    }, client),
    gain: category.disposalGainAccountId || category.disposalGainAccountNumber
      ? await resolveAccountId({
          accountId: category.disposalGainAccountId,
          accountNumber: category.disposalGainAccountNumber,
          label: category.disposalGainAccount?.label || 'Disposal gain',
        }, client)
      : null,
    loss: category.disposalLossAccountId || category.disposalLossAccountNumber
      ? await resolveAccountId({
          accountId: category.disposalLossAccountId,
          accountNumber: category.disposalLossAccountNumber,
          label: category.disposalLossAccount?.label || 'Disposal loss',
        }, client)
      : null,
  };
}

function computeMonthlyDepreciation(asset) {
  const base = toNumber(asset.cost) - toNumber(asset.salvage || 0);
  if (asset.usefulLifeMonths <= 0) throw new Error('usefulLifeMonths must be > 0');
  return round2(base / asset.usefulLifeMonths);
}

export async function createAsset(data) {
  const ref = await nextSequence(prisma, 'ASSET', 'AS-');
  const asset = await prisma.asset.create({
    data: {
      ref,
      label: data.label,
      categoryId: data.categoryId,
      acquisitionDate: new Date(data.acquisitionDate),
      inServiceDate: data.inServiceDate ? new Date(data.inServiceDate) : null,
      cost: data.cost,
      salvage: data.salvage ?? 0,
      usefulLifeMonths: data.usefulLifeMonths,
      method: data.method || 'LINEAR',
      status: data.status || 'ACTIVE',
      meta: data.meta ?? null,
    },
  });
  return asset;
}

export async function generateDepreciationLine(assetId, year, month, client = prisma) {
  const asset = await client.asset.findUnique({
    where: { id: assetId },
    include: { category: true },
  });
  if (!asset) throw new Error('Asset not found');
  if (asset.status === 'DISPOSED') throw new Error('Asset disposed');
  const existing = await client.depreciationLine.findUnique({
    where: { assetId_year_month: { assetId, year, month } },
  });
  if (existing) return existing;
  const amount = computeMonthlyDepreciation(asset);
  const cumuPrev = await client.depreciationLine.aggregate({
    _sum: { amount: true },
    where: { assetId, status: 'POSTED' },
  });
  const cumulative = round2(toNumber(cumuPrev._sum.amount) + amount);
  return client.depreciationLine.create({
    data: { assetId, year, month, amount, cumulative, status: 'PLANNED' },
  });
}

export async function postDepreciation(assetId, year, month) {
  return prisma.$transaction(async (tx) => {
    const asset = await tx.asset.findUnique({
      where: { id: assetId },
      include: { category: true },
    });
    if (!asset) throw new Error('Asset not found');
    if (asset.status === 'DISPOSED') throw new Error('Asset disposed');
    const line = await generateDepreciationLine(assetId, year, month, tx);
    if (line.status === 'POSTED') return { alreadyPosted: true, line };
    const accounts = await resolveCategoryAccounts(asset.category, tx);
    const desc = `Dotation amortissement ${asset.ref} ${month}/${year}`;
    const today = new Date();
    const debit = await tx.transaction.create({
      data: {
        date: today,
        description: desc,
        amount: toNumber(line.amount),
        direction: 'DEBIT',
        kind: 'ASSET_DEPRECIATION_EXPENSE',
        accountId: accounts.expense,
      },
    });
    const credit = await tx.transaction.create({
      data: {
        date: today,
        description: desc,
        amount: toNumber(line.amount),
        direction: 'CREDIT',
        kind: 'ASSET_DEPRECIATION_RESERVE',
        accountId: accounts.depreciation,
      },
    });
    const journal = await finalizeBatchToJournal(tx, {
      sourceType: 'ASSET',
      sourceId: asset.id,
      date: today,
      description: desc,
      transactions: [debit, credit],
    });
    const posted = await tx.depreciationLine.update({
      where: { id: line.id },
      data: { status: 'POSTED', journalEntryId: journal.id, postedAt: today },
    });
    return { journal, line: posted };
  });
}

export async function disposeAsset(assetId, { date, proceed, proceedAccountNumber }) {
  return prisma.$transaction(async (tx) => {
    const asset = await tx.asset.findUnique({
      where: { id: assetId },
      include: { category: true, depreciationLines: { where: { status: 'POSTED' } } },
    });
    if (!asset) throw new Error('Asset not found');
    if (asset.status === 'DISPOSED') throw new Error('Already disposed');
    const accounts = await resolveCategoryAccounts(asset.category, tx);
    const proceedAccId = await resolveAccountId({
      accountNumber: proceedAccountNumber || '512000',
      label: 'Produit de cession',
    }, tx);
    const cumu = round2(asset.depreciationLines.reduce((s, l) => s + toNumber(l.amount), 0));
    const cost = toNumber(asset.cost);
    const netBook = round2(cost - cumu);
    const proceedAmount = round2(toNumber(proceed || 0));
    const today = date ? new Date(date) : new Date();
    const txns = [];
    const desc = `Cession immobilisation ${asset.ref}`;
    if (proceedAmount > 0) {
      txns.push(await tx.transaction.create({
        data: {
          date: today,
          description: desc,
          amount: proceedAmount,
          direction: 'DEBIT',
          kind: 'ASSET_DISPOSAL_GAIN',
          accountId: proceedAccId,
        },
      }));
    }
    if (cumu > 0) {
      txns.push(await tx.transaction.create({
        data: {
          date: today,
          description: desc,
          amount: cumu,
          direction: 'DEBIT',
          kind: 'ASSET_DEPRECIATION_RESERVE',
          accountId: accounts.depreciation,
        },
      }));
    }
    txns.push(await tx.transaction.create({
      data: {
        date: today,
        description: desc,
        amount: cost,
        direction: 'CREDIT',
        kind: 'ASSET_CLEARING',
        accountId: accounts.asset,
      },
    }));
    const delta = round2(proceedAmount - netBook);
    if (delta > 0) {
      if (!accounts.gain) throw new Error('Missing disposal gain account on category');
      txns.push(await tx.transaction.create({
        data: {
          date: today,
          description: desc,
          amount: delta,
          direction: 'CREDIT',
          kind: 'ASSET_DISPOSAL_GAIN',
          accountId: accounts.gain,
        },
      }));
    } else if (delta < 0) {
      if (!accounts.loss) throw new Error('Missing disposal loss account on category');
      txns.push(await tx.transaction.create({
        data: {
          date: today,
          description: desc,
          amount: Math.abs(delta),
          direction: 'DEBIT',
          kind: 'ASSET_DISPOSAL_LOSS',
          accountId: accounts.loss,
        },
      }));
    }
    const journal = await finalizeBatchToJournal(tx, {
      sourceType: 'ASSET',
      sourceId: asset.id,
      date: today,
      description: desc,
      transactions: txns,
    });
    const disposal = await tx.assetDisposal.create({
      data: {
        assetId: asset.id,
        date: today,
        proceed: proceedAmount,
        gainLoss: delta,
        journalEntryId: journal.id,
      },
    });
    await tx.asset.update({ where: { id: asset.id }, data: { status: 'DISPOSED' } });
    return { journal, disposal, netBook, gainLoss: delta };
  });
}

// Post all depreciations for a given period in a single balanced journal.
export async function postDepreciationBatch(year, month) {
  if (!year || !month) throw new Error('year/month requis');
  return prisma.$transaction(async (tx) => {
    const already = await tx.depreciationLine.count({ where: { year, month, status: 'POSTED' } });
    if (already > 0) throw new Error(`Dotations ${month}/${year} déjà postées`);
    const assets = await tx.asset.findMany({
      where: { status: { not: 'DISPOSED' } },
      include: { category: true },
    });
    if (!assets.length) throw new Error('Aucun actif éligible');

    // Ensure lines exist and collect amounts
    const lines = [];
    for (const asset of assets) {
      const line = await generateDepreciationLine(asset.id, year, month, tx);
      lines.push({ line, asset });
    }

    const expenseMap = new Map(); // accountId -> amount
    const reserveMap = new Map();
    const today = new Date();
    const lineIds = [];
    for (const { line, asset } of lines) {
      const amt = toNumber(line.amount);
      if (!(amt > 0)) continue;
      const accs = await resolveCategoryAccounts(asset.category, tx);
      expenseMap.set(accs.expense, (expenseMap.get(accs.expense) || 0) + amt);
      reserveMap.set(accs.depreciation, (reserveMap.get(accs.depreciation) || 0) + amt);
      lineIds.push(line.id);
    }
    const txns = [];
    for (const [accId, amt] of expenseMap.entries()) {
      txns.push(await tx.transaction.create({
        data: {
          date: today,
          description: `Dotations amort. ${month}/${year}`,
          amount: round2(amt),
          direction: 'DEBIT',
          kind: 'ASSET_DEPRECIATION_EXPENSE',
          accountId: accId,
        },
      }));
    }
    for (const [accId, amt] of reserveMap.entries()) {
      txns.push(await tx.transaction.create({
        data: {
          date: today,
          description: `Dotations amort. ${month}/${year}`,
          amount: round2(amt),
          direction: 'CREDIT',
          kind: 'ASSET_DEPRECIATION_RESERVE',
          accountId: accId,
        },
      }));
    }
    if (!txns.length) throw new Error('Aucune dotation à poster (montant nul)');

    const journal = await finalizeBatchToJournal(tx, {
      sourceType: 'ASSET',
      sourceId: `${year}-${month}`,
      date: today,
      description: `Dotations amort. ${month}/${year}`,
      transactions: txns,
    });
    await tx.depreciationLine.updateMany({
      where: { id: { in: lineIds } },
      data: { status: 'POSTED', journalEntryId: journal.id, postedAt: today },
    });
    return { journalNumber: journal.number, postedCount: lineIds.length, total: txns.reduce((s, t) => s + toNumber(t.amount), 0) };
  });
}
