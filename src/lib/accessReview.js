import prisma from "@/lib/prisma";

export const REVIEW_DELAY_HOURS = Number(process.env.ACCESS_REVIEW_DELAY_HOURS || 24);

export function reviewVisibleAfter(from = new Date()) {
  return new Date(from.getTime() + REVIEW_DELAY_HOURS * 60 * 60 * 1000);
}

export function isVisibleNow(request, now = new Date()) {
  return request?.visibleAfterAt && new Date(request.visibleAfterAt).getTime() <= now.getTime();
}

export function pendingMessage() {
  return `Votre demande est enregistrée. Une réponse sera disponible dans un délai de ${REVIEW_DELAY_HOURS} heures.`;
}

export function waitingDecisionMessage() {
  return `Votre demande est encore en cours de traitement. Une réponse sera disponible dans un délai de ${REVIEW_DELAY_HOURS} heures.`;
}

export function waitingVisibilityMessage() {
  return `Votre demande a été traitée. La réponse sera disponible à votre prochaine tentative après le délai de ${REVIEW_DELAY_HOURS} heures.`;
}

export async function activateApprovedAccessRequest(request, db = prisma) {
  const membership = await db.companyMembership.upsert({
    where: {
      companyId_userId: {
        companyId: request.companyId,
        userId: request.requesterUserId,
      },
    },
    update: {
      role: request.requestedRole || "VIEWER",
      isActive: true,
      isDefault: true,
    },
    create: {
      companyId: request.companyId,
      userId: request.requesterUserId,
      role: request.requestedRole || "VIEWER",
      isActive: true,
      isDefault: true,
    },
  });

  await db.user.update({
    where: { id: request.requesterUserId },
    data: {
      isActive: true,
      companyId: request.companyId,
      role: membership.role,
    },
  });

  await db.userAccessRequest.update({
    where: { id: request.id },
    data: { resultDeliveredAt: new Date() },
  });

  return membership;
}

export async function activateApprovedCompanyRequest(request, db = prisma) {
  if (!request.createdCompanyId) return null;

  const membership = await db.companyMembership.upsert({
    where: {
      companyId_userId: {
        companyId: request.createdCompanyId,
        userId: request.requesterUserId,
      },
    },
    update: {
      role: "SUPERADMIN",
      isActive: true,
      isDefault: true,
    },
    create: {
      companyId: request.createdCompanyId,
      userId: request.requesterUserId,
      role: "SUPERADMIN",
      isActive: true,
      isDefault: true,
    },
  });

  await db.user.update({
    where: { id: request.requesterUserId },
    data: {
      isActive: true,
      canCreateCompany: true,
      companyId: request.createdCompanyId,
      role: "SUPERADMIN",
    },
  });

  await db.companyCreationRequest.update({
    where: { id: request.id },
    data: { resultDeliveredAt: new Date() },
  });

  return membership;
}
