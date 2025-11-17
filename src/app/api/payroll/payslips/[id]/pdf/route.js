import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { PDFDocument, rgb } from 'pdf-lib';
import { loadPrimaryFont, drawFooter, drawPageHeader } from '@/lib/pdf/utils';
import { featureFlags } from '@/lib/features';

export async function GET(_req, { params }) {
  if (!featureFlags.payroll) return NextResponse.json({ error: 'Payroll disabled' }, { status: 403 });
  const payslip = await prisma.payslip.findUnique({
    where: { id: params.id },
    include: { employee: true, lines: true, period: true }
  });
  if (!payslip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await loadPrimaryFont(pdfDoc);
  drawPageHeader(page, { font, title: `Bulletin ${payslip.ref}`, subTitle: `Période ${payslip.period.month}/${payslip.period.year}` });
  let y = 780;
  const line = (txt, size=10, color=rgb(0,0,0)) => { page.drawText(txt, { x: 40, y, size, font, color }); y -= 14; };
  line(`Employé: ${payslip.employee.firstName} ${payslip.employee.lastName}`);
  line(`Brut: ${payslip.grossAmount.toString()}  Net: ${payslip.netAmount.toString()}`);
  y -= 8; line('Détail lignes:', 11, rgb(0.1,0.1,0.5)); y -= 4;
  for (const l of payslip.lines.slice(0, 40)) { // simple pagination stub
    if (y < 80) { // new page
      const np = pdfDoc.addPage([595.28, 841.89]);
      drawPageHeader(np, { font, title: `Bulletin ${payslip.ref}`, subTitle: 'Suite' });
      y = 780; page.drawText('');
    }
    line(`${l.code} ${l.label} (${l.kind})  Montant: ${l.amount.toString()}`);
  }
  drawFooter(page, { font, pageNumber: 1, totalPages: pdfDoc.getPageCount(), legal: 'Document généré automatiquement - Non signé.' });
  const bytes = await pdfDoc.save();
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=payslip-${payslip.ref}.pdf`
    }
  });
}
