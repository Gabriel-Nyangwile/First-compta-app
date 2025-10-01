// Helper for generating sequential numbers using the Sequence table.
// Usage: await nextSequence(prisma, 'PO', 'PO-'); -> returns e.g. 'PO-000001'
export async function nextSequence(prisma, name, prefix = '') {
  const row = await prisma.sequence.upsert({
    where: { name },
    update: { value: { increment: 1 } },
    create: { name, value: 1 }
  });
  const current = row.value;
  // When updating with increment Prisma returns pre-increment value in row.value for older versions;
  // to be safe re-read after update if needed.
  let value = current;
  if (value === 0) {
    const reread = await prisma.sequence.findUnique({ where: { name } });
    value = reread?.value || 1;
  }
  const formatted = String(value).padStart(6, '0');
  return `${prefix}${formatted}`;
}
