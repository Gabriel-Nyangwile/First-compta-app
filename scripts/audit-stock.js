#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const EPSILON = 0.0005;

function parseArgs(argv) {
  const args = {
    company: null,
    companyId: null,
    fix: false,
    noFail: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--fix') args.fix = true;
    else if (arg === '--no-fail') args.noFail = true;
    else if (arg === '--company' || arg === '--companyId') args[arg.slice(2)] = argv[++i] || '';
    else if (arg.startsWith('--company=')) args.company = arg.slice('--company='.length);
    else if (arg.startsWith('--companyId=')) args.companyId = arg.slice('--companyId='.length);
    else {
      throw new Error(`Option inconnue: ${arg}`);
    }
  }

  return args;
}

async function resolveCompanyFilter(args) {
  if (args.companyId) return { id: args.companyId };
  if (!args.company) return null;
  const company = await prisma.company.findFirst({
    where: { name: args.company },
    select: { id: true, name: true },
  });
  if (!company) throw new Error(`Societe introuvable: ${args.company}`);
  return { id: company.id };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const companyFilter = await resolveCompanyFilter(args);
  const products = await prisma.product.findMany({
    where: companyFilter ? { companyId: companyFilter.id } : {},
    select: { id: true, sku: true, name: true, companyId: true },
  });
  let inconsistencies = 0;
  for (const p of products) {
    const agg = await prisma.stockMovement.groupBy({
      by: ['productId', 'movementType', 'stage'],
      where: { productId: p.id },
      _sum: { quantity: true }
    });
    let availableIn = 0, availableOut = 0, availableAdjust = 0;
    let stagedIn = 0, stagedOut = 0, stagedAdjust = 0;
    for (const g of agg) {
      const q = Number(g._sum.quantity || 0);
      const isStaged = g.stage === 'STAGED';
      if (g.movementType === 'IN') {
        if (isStaged) stagedIn += q;
        else availableIn += q;
      } else if (g.movementType === 'OUT') {
        if (isStaged) stagedOut += q;
        else availableOut += q;
      } else {
        if (isStaged) stagedAdjust += q;
        else availableAdjust += q;
      }
    }
    const theoreticalOnHand = availableIn - availableOut + availableAdjust;
    const theoreticalStaged = stagedIn - stagedOut + stagedAdjust;
    const inv = await prisma.productInventory.findUnique({ where: { productId: p.id } });
    const storedOnHand = inv ? Number(inv.qtyOnHand) : 0;
    const storedStaged = inv ? Number(inv.qtyStaged || 0) : 0;
    const diffOnHand = +(theoreticalOnHand - storedOnHand).toFixed(3);
    const diffStaged = +(theoreticalStaged - storedStaged).toFixed(3);
    if (Math.abs(diffOnHand) > EPSILON || Math.abs(diffStaged) > EPSILON) {
      inconsistencies++;
      console.log(`⚠️  ${p.sku} ${p.name} onHandDiff=${diffOnHand} stagedDiff=${diffStaged} (calcOnHand=${theoreticalOnHand.toFixed(3)} storedOnHand=${storedOnHand.toFixed(3)} calcStaged=${theoreticalStaged.toFixed(3)} storedStaged=${storedStaged.toFixed(3)})`);
      if (args.fix) {
        await prisma.productInventory.upsert({
          where: { productId: p.id },
          update: {
            qtyOnHand: theoreticalOnHand.toFixed(3),
            qtyStaged: theoreticalStaged.toFixed(3),
          },
          create: {
            productId: p.id,
            companyId: p.companyId,
            qtyOnHand: theoreticalOnHand.toFixed(3),
            qtyStaged: theoreticalStaged.toFixed(3),
          }
        });
        console.log('   → Fix applied');
      }
    }
  }
  if (!inconsistencies) console.log('✅ Aucune divergence stock.');
  else console.log(`Terminé. Divergences: ${inconsistencies}`);
  if (inconsistencies && !args.fix && !args.noFail) {
    process.exitCode = 1;
  }
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
