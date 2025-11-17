#!/usr/bin/env node
import prisma from '../src/lib/prisma.js';

function parseArgs() {
  const args = Object.create(null);
  for (const raw of process.argv.slice(2)) {
    const [k, v] = raw.includes('=') ? raw.split('=') : [raw, 'true'];
    const key = k.replace(/^--/, '');
    args[key] = v;
  }
  return args;
}

function splitList(val) {
  if (!val) return [];
  return String(val)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const args = parseArgs();
  const ids = splitList(args.ids);
  const emails = splitList(args.emails);
  const unset = args.unset === 'true' || args.unset === '1';
  const dryRun = args.dry === 'true' || args['dry-run'] === 'true' || args.dry === '1' || args['dry-run'] === '1';
  const all = args.all === 'true' || args.all === '1' || args.all === true;
  const contains = args.contains ? String(args.contains).trim() : '';

  if (!all && !ids.length && !emails.length) {
    console.log('Usage:');
    console.log('  node scripts/mark-expatriates.js --emails=email1@example.com,email2@example.com');
    console.log('  node scripts/mark-expatriates.js --ids=uuid1,uuid2');
    console.log('  node scripts/mark-expatriates.js --all [--contains=substring]');
    console.log('Options: --unset (set to false), --dry or --dry-run');
    process.exit(1);
  }

  const where = {};
  if (!all) {
    if (ids.length) where.id = { in: ids };
    if (emails.length) where.email = { in: emails };
  }
  if (contains) {
    where.OR = [
      { email: { contains, mode: 'insensitive' } },
      { firstName: { contains, mode: 'insensitive' } },
      { lastName: { contains, mode: 'insensitive' } },
    ];
  }

  const list = await prisma.employee.findMany({ where, select: { id: true, email: true, firstName: true, lastName: true, isExpat: true } });
  if (!list.length) {
    console.log('[INFO] No matching employees found for provided filters.');
    return;
  }

  console.log(`[INFO] Will ${(unset ? 'unset' : 'set')} isExpat for ${list.length} employee(s):`);
  for (const e of list) {
    console.log(` - ${e.firstName || ''} ${e.lastName || ''} <${e.email || e.id}> isExpat=${e.isExpat}`);
  }

  if (dryRun) {
    console.log('[DRY-RUN] No changes applied.');
    return;
  }

  const result = await prisma.employee.updateMany({ where, data: { isExpat: !unset } });
  console.log(`[OK] Updated ${result.count} employee(s).`);
}

main()
  .catch((e) => {
    console.error('mark-expatriates failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
