// Helper for generating sequential numbers using the Sequence table.
// Usage: await nextSequence(prisma, 'PO', 'PO-', companyId); -> returns e.g. 'PO-000001'
export async function nextSequence(prisma, name, prefix = '', companyId = null) {
  const scopedCompanyId = companyId || (process.env.DEFAULT_COMPANY_ID || '').trim() || null;
  const row = await prisma.sequence.upsert({
    where: { companyId_name: { companyId: scopedCompanyId, name } },
    update: { value: { increment: 1 } },
    create: { name, value: 1, companyId: scopedCompanyId }
  });
  const current = row.value;
  // When updating with increment Prisma returns pre-increment value in row.value for older versions;
  // to be safe re-read after update if needed.
  let value = current;
  if (value === 0) {
    const reread = await prisma.sequence.findUnique({
      where: { companyId_name: { companyId: scopedCompanyId, name } },
    });
    value = reread?.value || 1;
  }
  const formatted = String(value).padStart(6, '0');
  return `${prefix}${formatted}`;
}
