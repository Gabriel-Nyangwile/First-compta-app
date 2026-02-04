import prisma from '@/lib/prisma';
import { audit } from '@/lib/audit';

export class PurchaseOrderApprovalError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'PurchaseOrderApprovalError';
    this.status = status;
  }
}

export async function approvePurchaseOrder(id, companyId) {
  if (!id) {
    throw new PurchaseOrderApprovalError("Identifiant du bon de commande manquant.", 400);
  }
  if (!companyId) {
    throw new PurchaseOrderApprovalError("companyId manquant.", 400);
  }

  const po = await prisma.purchaseOrder.findUnique({
    where: { id, companyId },
    select: { id: true, status: true }
  });

  if (!po) {
    throw new PurchaseOrderApprovalError('Bon de commande introuvable.', 404);
  }

  if (po.status !== 'DRAFT') {
    throw new PurchaseOrderApprovalError(`Impossible d'approuver: statut actuel ${po.status}.`, 409);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.purchaseOrder.update({
      where: { id, companyId },
      data: { status: 'APPROVED' }
    });

    await tx.purchaseOrderStatusLog.create({
      data: {
        companyId,
        purchaseOrderId: id,
        oldStatus: po.status,
        newStatus: 'APPROVED',
        note: 'Approbation'
      }
    });

    await audit(tx, {
      entityType: 'PurchaseOrder',
      entityId: id,
      action: 'APPROVE',
      data: { from: po.status, to: 'APPROVED' }
    });

    return next;
  });

  return updated;
}
