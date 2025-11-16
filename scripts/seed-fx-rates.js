#!/usr/bin/env node
// Seed sample EUR->CDF monthly FX rates for payroll periods.
import prisma from '../src/lib/prisma.js';

const sampleRates = [
  { date: '2025-09-30', rate: 2700.0 },
  { date: '2025-10-31', rate: 2712.5 },
  { date: '2025-11-30', rate: 2695.3 },
  { date: '2025-12-31', rate: 2720.8 },
  { date: '2026-01-31', rate: 2731.4 },
  { date: '2026-02-28', rate: 2744.9 },
  { date: '2026-03-31', rate: 2755.2 },
  { date: '2026-04-30', rate: 2766.7 },
  { date: '2026-05-31', rate: 2778.1 },
];

async function main() {
  for (const r of sampleRates) {
    const dt = new Date(r.date + 'T00:00:00Z');
    await prisma.fxRate.upsert({
      where: { date_baseCurrency_quoteCurrency: { date: dt, baseCurrency: 'EUR', quoteCurrency: 'CDF' } },
      update: { rate: r.rate, source: 'seed-script' },
      create: { date: dt, baseCurrency: 'EUR', quoteCurrency: 'CDF', rate: r.rate, source: 'seed-script' }
    });
    console.log(`↑ FX ${r.date} EUR/CDF ${r.rate}`);
  }
}

main().then(async()=>{await prisma.$disconnect();}).catch(async e=>{console.error(e); await prisma.$disconnect(); process.exit(1);});
