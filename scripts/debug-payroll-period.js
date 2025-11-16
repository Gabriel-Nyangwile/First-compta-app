#!/usr/bin/env node
import prisma from '../src/lib/prisma.js';

async function main() {
  const period = await prisma.payrollPeriod.findFirst({ orderBy: { openedAt: 'desc' }, include: { payslips: { include: { lines: true } } } });
  if (!period) { console.log('No period'); return; }
  console.log('Period', period.ref, period.month, period.year, period.status);
  let gross=0, cnssEmp=0, cnssEr=0, onem=0, inpp=0, ipr=0, net=0;
  for (const ps of period.payslips) {
    net += Number(ps.netAmount?.toNumber?.() ?? ps.netAmount);
    for (const l of ps.lines) {
      const amt = Number(l.amount?.toNumber?.() ?? l.amount);
      if (['BASE','PRIME'].includes(l.code)) gross += amt>0?amt:0;
      if (l.code==='CNSS_EMP') cnssEmp += Math.abs(amt);
      if (l.code==='CNSS_ER') cnssEr += amt;
      if (l.code==='ONEM') onem += amt;
      if (l.code==='INPP') inpp += amt;
      if (l.code==='IPR') ipr += Math.abs(amt);
    }
  }
  console.log({gross, cnssEmp, cnssEr, onem, inpp, ipr, net, debitExpected: gross+cnssEr+onem+inpp, creditExpected: net+cnssEmp+ipr+cnssEr+onem+inpp});
  await prisma.$disconnect();
}
main().catch(e=>{console.error(e);});
