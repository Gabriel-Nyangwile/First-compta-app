#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import prisma from "../src/lib/prisma.js";

const ROLLBACK_SENTINEL = "__ROLLBACK_MULTI_COMPANY_ONBOARDING_TEST__";

function assert(condition, message, details = null) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

async function main() {
  const runId = randomUUID().slice(0, 8);
  const now = new Date();
  const email = `mc-onboarding-${runId}@example.test`;
  const username = `mc-onboarding-${runId}`;
  const requestedName = `MC TEST ${runId}`;

  const checks = [];

  try {
    await prisma.$transaction(async (tx) => {
      const platformAdmin = await tx.user.findFirst({
        where: { role: "PLATFORM_ADMIN", isActive: true },
        select: { id: true, email: true },
        orderBy: { createdAt: "asc" },
      });
      assert(platformAdmin, "Aucun PLATFORM_ADMIN actif disponible pour le smoke test.");

      const user = await tx.user.create({
        data: {
          email,
          username,
          password: "hashed-placeholder",
          role: "VIEWER",
          isActive: false,
          canCreateCompany: false,
        },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          canCreateCompany: true,
          companyId: true,
        },
      });

      checks.push({
        step: "signup",
        ok:
          user.role === "VIEWER" &&
          user.isActive === false &&
          user.canCreateCompany === false &&
          user.companyId == null,
      });

      const membershipsAfterSignup = await tx.companyMembership.count({
        where: { userId: user.id },
      });
      assert(membershipsAfterSignup === 0, "Le signup public ne doit créer aucun membership.", {
        userId: user.id,
        membershipsAfterSignup,
      });

      const approvedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          isActive: true,
          canCreateCompany: true,
        },
        select: {
          id: true,
          isActive: true,
          canCreateCompany: true,
          companyId: true,
        },
      });

      checks.push({
        step: "platform-approval",
        ok:
          approvedUser.isActive === true &&
          approvedUser.canCreateCompany === true &&
          approvedUser.companyId == null,
      });

      const company = await tx.company.create({
        data: {
          name: requestedName,
          address: "Test Address",
          legalForm: "SARL",
          currency: "XOF",
          rccmNumber: `RCCM-${runId}`,
          idNatNumber: `IDN-${runId}`,
          taxNumber: `TAX-${runId}`,
          cnssNumber: `CNSS-${runId}`,
          onemNumber: `ONEM-${runId}`,
          inppNumber: `INPP-${runId}`,
          vatPolicy: "STANDARD",
          country: "CD",
          timezone: "Africa/Kinshasa",
          fiscalYearStart: "01-01",
        },
        select: { id: true, name: true },
      });

      const membership = await tx.companyMembership.create({
        data: {
          companyId: company.id,
          userId: user.id,
          role: "SUPERADMIN",
          isActive: true,
          isDefault: true,
        },
        select: {
          id: true,
          companyId: true,
          userId: true,
          role: true,
          isActive: true,
          isDefault: true,
        },
      });

      const finalizedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          companyId: company.id,
          canCreateCompany: false,
        },
        select: {
          id: true,
          companyId: true,
          canCreateCompany: true,
        },
      });

      checks.push({
        step: "self-create-company",
        ok:
          membership.role === "SUPERADMIN" &&
          membership.isActive === true &&
          membership.isDefault === true &&
          finalizedUser.companyId === company.id &&
          finalizedUser.canCreateCompany === false,
      });

      const request = await tx.companyCreationRequest.create({
        data: {
          requesterUserId: platformAdmin.id,
          requestedName: `${requestedName} REQUEST`,
          currency: "XOF",
        },
        select: {
          id: true,
          status: true,
        },
      });

      const approvedCompany = await tx.company.create({
        data: {
          name: `${requestedName} APPROVED`,
          currency: "XOF",
        },
        select: { id: true, name: true },
      });

      await tx.companyMembership.upsert({
        where: {
          companyId_userId: {
            companyId: approvedCompany.id,
            userId: platformAdmin.id,
          },
        },
        update: {
          role: "SUPERADMIN",
          isActive: true,
          isDefault: true,
        },
        create: {
          companyId: approvedCompany.id,
          userId: platformAdmin.id,
          role: "SUPERADMIN",
          isActive: true,
          isDefault: true,
        },
      });

      const approvedRequest = await tx.companyCreationRequest.update({
        where: { id: request.id },
        data: {
          status: "APPROVED",
          createdCompanyId: approvedCompany.id,
          reviewedByUserId: platformAdmin.id,
          reviewedAt: now,
          reviewNote: "Approved",
        },
        select: {
          id: true,
          status: true,
          createdCompanyId: true,
          reviewedByUserId: true,
          reviewedAt: true,
        },
      });

      checks.push({
        step: "approved-request-flow",
        ok:
          approvedRequest.status === "APPROVED" &&
          approvedRequest.createdCompanyId === approvedCompany.id &&
          approvedRequest.reviewedByUserId === platformAdmin.id &&
          approvedRequest.reviewedAt != null,
      });

      throw new Error(ROLLBACK_SENTINEL);
    });
  } catch (error) {
    if (error.message !== ROLLBACK_SENTINEL) {
      console.error("test-multi-company-onboarding-flow error:", error.message);
      if (error.details) {
        console.error(JSON.stringify(error.details, null, 2));
      }
      process.exit(1);
    }
  }

  const failedChecks = checks.filter((check) => !check.ok);

  console.log("=== Multi-Company Onboarding Flow Test ===");
  for (const check of checks) {
    console.log(`- ${check.step}: ${check.ok ? "OK" : "FAILED"}`);
  }

  if (failedChecks.length > 0) {
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error("test-multi-company-onboarding-flow fatal:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
