import prisma from '@/lib/prisma';

export async function audit(txOrClient, { companyId = null, entityType, entityId, action, data }) {
  const client = txOrClient || prisma;
  try {
    await client.auditLog.create({ data: { companyId, entityType, entityId, action, data } });
  } catch (e) {
    console.warn('Audit log write failed', e);
  }
}
