#!/usr/bin/env node
import prisma from "../src/lib/prisma.js";

function parseArgs(argv) {
  const args = argv.slice(2);
  const getValue = (flag) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : null;
  };
  const limitRaw = Number(getValue("--limit"));
  return {
    companyId: getValue("--companyId"),
    limit: Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 10,
    asJson: args.includes("--json"),
  };
}

function pushIssue(list, kind, message, example = null) {
  list.push({ kind, message, example });
}

function formatValue(value) {
  if (value == null) return "null";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function printSection(title, issues) {
  console.log(`\n${title}: ${issues.length}`);
  for (const issue of issues) {
    console.log(`- [${issue.kind}] ${issue.message}`);
    if (issue.example) {
      console.log(
        `  ${Object.entries(issue.example)
          .map(([key, value]) => `${key}=${formatValue(value)}`)
          .join(" ")}`
      );
    }
  }
}

async function main() {
  const { companyId, limit, asJson } = parseArgs(process.argv);
  const scoped = companyId ? { companyId } : {};
  const failures = [];
  const warnings = [];

  const [companies, users, memberships, transactions, companyRequests] = await Promise.all([
    prisma.company.findMany({
      where: companyId ? { id: companyId } : {},
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        canCreateCompany: true,
        companyId: true,
      },
      orderBy: { email: "asc" },
    }),
    prisma.companyMembership.findMany({
      where: companyId ? { companyId } : {},
      select: {
        id: true,
        companyId: true,
        userId: true,
        role: true,
        isActive: true,
        isDefault: true,
        company: { select: { name: true } },
        user: { select: { email: true, role: true, isActive: true, canCreateCompany: true } },
      },
      orderBy: [{ companyId: "asc" }, { createdAt: "asc" }],
    }),
    prisma.transaction.findMany({
      where: scoped,
      select: {
        id: true,
        companyId: true,
        journalEntryId: true,
        accountId: true,
        account: { select: { companyId: true, number: true } },
        journalEntry: { select: { companyId: true, number: true } },
      },
    }),
    prisma.companyCreationRequest.findMany({
      select: {
        id: true,
        status: true,
        requesterUserId: true,
        createdCompanyId: true,
        reviewedByUserId: true,
        reviewedAt: true,
        requestedName: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const activeMembershipsByUser = new Map();
  const activeMembershipsByCompany = new Map();
  const superadminsByCompany = new Map();

  for (const membership of memberships) {
    if (!membership.isActive) continue;
    const byUser = activeMembershipsByUser.get(membership.userId) || [];
    byUser.push(membership);
    activeMembershipsByUser.set(membership.userId, byUser);

    const byCompany = activeMembershipsByCompany.get(membership.companyId) || [];
    byCompany.push(membership);
    activeMembershipsByCompany.set(membership.companyId, byCompany);

    if (membership.role === "SUPERADMIN") {
      superadminsByCompany.set(
        membership.companyId,
        (superadminsByCompany.get(membership.companyId) || 0) + 1
      );
    }
  }

  for (const user of users) {
    if (!user.isActive) continue;
    if (user.role === "PLATFORM_ADMIN") continue;
    const userMemberships = activeMembershipsByUser.get(user.id) || [];
    if (userMemberships.length === 0 && !user.canCreateCompany) {
      pushIssue(failures, "active-user-without-access", "Utilisateur actif sans membership ni droit temporaire de créer une société.", {
        userId: user.id,
        email: user.email,
        role: user.role,
      });
    }
    if (user.canCreateCompany && userMemberships.length > 0) {
      pushIssue(warnings, "stale-can-create-company", "Utilisateur avec droit temporaire de création alors qu'il a déjà un membership actif.", {
        userId: user.id,
        email: user.email,
        memberships: userMemberships.length,
      });
    }
    if (userMemberships.length > 1 && !userMemberships.some((membership) => membership.isDefault)) {
      pushIssue(warnings, "missing-default-membership", "Utilisateur multi-sociétés sans membership par défaut.", {
        userId: user.id,
        email: user.email,
        memberships: userMemberships.length,
      });
    }
  }

  for (const company of companies) {
    const companyMemberships = activeMembershipsByCompany.get(company.id) || [];
    if (companyMemberships.length === 0) {
      pushIssue(failures, "company-without-active-users", "Société sans membership actif.", {
        companyId: company.id,
        companyName: company.name,
      });
    }
    if ((superadminsByCompany.get(company.id) || 0) === 0) {
      pushIssue(warnings, "company-without-superadmin", "Société sans SUPERADMIN actif.", {
        companyId: company.id,
        companyName: company.name,
      });
    }
  }

  for (const transaction of transactions) {
    if (transaction.account?.companyId && transaction.account.companyId !== transaction.companyId) {
      pushIssue(failures, "ledger-account-leak", "Le grand livre lirait un compte d'une autre société.", {
        transactionId: transaction.id,
        transactionCompanyId: transaction.companyId,
        accountId: transaction.accountId,
        accountCompanyId: transaction.account.companyId,
        accountNumber: transaction.account.number,
      });
    }
    if (transaction.journalEntry?.companyId && transaction.journalEntry.companyId !== transaction.companyId) {
      pushIssue(failures, "journal-line-leak", "Le journal lirait une ligne rattachée à une autre société.", {
        transactionId: transaction.id,
        transactionCompanyId: transaction.companyId,
        journalEntryId: transaction.journalEntryId,
        journalCompanyId: transaction.journalEntry.companyId,
        journalNumber: transaction.journalEntry.number,
      });
    }
  }

  for (const request of companyRequests) {
    if (request.status !== "APPROVED" || !request.createdCompanyId) continue;
    const requesterMembership = memberships.find(
      (membership) =>
        membership.userId === request.requesterUserId &&
        membership.companyId === request.createdCompanyId &&
        membership.isActive
    );
    if (!requesterMembership) {
      pushIssue(failures, "approved-request-without-membership", "Demande approuvée sans membership actif pour le demandeur.", {
        requestId: request.id,
        requestedName: request.requestedName,
        requesterUserId: request.requesterUserId,
        createdCompanyId: request.createdCompanyId,
      });
      continue;
    }
    if (requesterMembership.role !== "SUPERADMIN") {
      pushIssue(failures, "approved-request-wrong-role", "Le demandeur approuvé n'est pas SUPERADMIN de sa société créée.", {
        requestId: request.id,
        requestedName: request.requestedName,
        requesterUserId: request.requesterUserId,
        createdCompanyId: request.createdCompanyId,
        membershipRole: requesterMembership.role,
      });
    }
  }

  const companySummaries = await Promise.all(
    companies.map(async (company) => {
      const [journals, transactionsCount, accounts, members] = await Promise.all([
        prisma.journalEntry.count({ where: { companyId: company.id } }),
        prisma.transaction.count({ where: { companyId: company.id } }),
        prisma.account.count({ where: { companyId: company.id } }),
        prisma.companyMembership.count({ where: { companyId: company.id, isActive: true } }),
      ]);
      return {
        companyId: company.id,
        companyName: company.name,
        journals,
        transactions: transactionsCount,
        accounts,
        activeMembers: members,
      };
    })
  );

  const report = {
    scope: companyId || "ALL",
    companies: companySummaries,
    failures,
    warnings,
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("=== Multi-Company Runtime Test ===");
    console.log(`Scope: ${report.scope}`);
    for (const company of companySummaries) {
      console.log(
        `- ${company.companyName} (${company.companyId}) journals=${company.journals} transactions=${company.transactions} accounts=${company.accounts} activeMembers=${company.activeMembers}`
      );
    }
    printSection("Failures", failures);
    printSection("Warnings", warnings.slice(0, limit));
  }

  process.exit(failures.length > 0 ? 1 : 0);
}

main()
  .catch((error) => {
    console.error("test-multi-company-runtime error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
