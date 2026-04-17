#!/usr/bin/env node
import prisma from "../src/lib/prisma.js";

function parseArgs(argv) {
  const args = argv.slice(2);
  const getValue = (flag) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : null;
  };
  const companyId = getValue("--companyId");
  const limitRaw = Number(getValue("--limit"));
  return {
    companyId,
    limit: Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 10,
    asJson: args.includes("--json"),
  };
}

function formatValue(value) {
  if (value == null) return "null";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function pushIssue(target, kind, message, example = null) {
  target.push({ kind, message, example });
}

function groupDuplicates(rows, keys) {
  const map = new Map();
  for (const row of rows) {
    const key = keys.map((field) => row[field] ?? "null").join("::");
    const current = map.get(key);
    if (current) {
      current.count += 1;
      continue;
    }
    const sample = {};
    for (const field of keys) sample[field] = row[field] ?? null;
    map.set(key, { count: 1, sample });
  }
  return [...map.values()].filter((row) => row.count > 1);
}

function summarizeIssues(title, issues) {
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
  const failures = [];
  const warnings = [];
  const scoped = companyId ? { companyId } : {};

  const [
    companies,
    memberships,
    users,
    accounts,
    journalEntries,
    transactions,
    companyRequests,
    auditLogs,
  ] = await Promise.all([
    prisma.company.findMany({
      where: companyId ? { id: companyId } : {},
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.companyMembership.findMany({
      where: companyId ? { companyId } : {},
      select: {
        id: true,
        companyId: true,
        userId: true,
        role: true,
        isDefault: true,
        isActive: true,
        user: { select: { email: true, isActive: true, companyId: true } },
        company: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        isActive: true,
        companyId: true,
      },
    }),
    prisma.account.findMany({
      where: scoped,
      select: { id: true, companyId: true, number: true },
    }),
    prisma.journalEntry.findMany({
      where: scoped,
      select: { id: true, companyId: true, number: true, sourceType: true, sourceId: true },
    }),
    prisma.transaction.findMany({
      where: scoped,
      select: {
        id: true,
        companyId: true,
        accountId: true,
        invoiceId: true,
        clientId: true,
        supplierId: true,
        incomingInvoiceId: true,
        moneyMovementId: true,
        journalEntryId: true,
        account: { select: { companyId: true, number: true } },
        invoice: { select: { companyId: true, invoiceNumber: true } },
        client: { select: { companyId: true, name: true } },
        supplier: { select: { companyId: true, name: true } },
        incomingInvoice: { select: { companyId: true, entryNumber: true } },
        moneyMovement: { select: { companyId: true, voucherRef: true } },
        journalEntry: { select: { companyId: true, number: true } },
      },
    }),
    prisma.companyCreationRequest.findMany({
      select: {
        id: true,
        status: true,
        requesterUserId: true,
        reviewedByUserId: true,
        createdCompanyId: true,
        reviewedAt: true,
        requestedName: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: scoped,
      select: { id: true, companyId: true, entityType: true, entityId: true, action: true },
      take: Math.max(limit * 20, 100),
    }),
  ]);

  if (!companies.length) {
    pushIssue(failures, "scope", "Aucune société trouvée pour le scope demandé.");
  }

  const duplicateAccounts = groupDuplicates(accounts, ["companyId", "number"]);
  for (const duplicate of duplicateAccounts.slice(0, limit)) {
    pushIssue(failures, "duplicate-account", "Numéro de compte dupliqué dans une même société.", {
      ...duplicate.sample,
      count: duplicate.count,
    });
  }

  const duplicateJournalEntries = groupDuplicates(journalEntries, ["companyId", "number"]);
  for (const duplicate of duplicateJournalEntries.slice(0, limit)) {
    pushIssue(failures, "duplicate-journal", "Numéro de journal dupliqué dans une même société.", {
      ...duplicate.sample,
      count: duplicate.count,
    });
  }

  const duplicateMemberships = groupDuplicates(memberships, ["companyId", "userId"]);
  for (const duplicate of duplicateMemberships.slice(0, limit)) {
    pushIssue(failures, "duplicate-membership", "Membership dupliqué pour un utilisateur dans une société.", {
      ...duplicate.sample,
      count: duplicate.count,
    });
  }

  const defaultMemberships = groupDuplicates(
    memberships.filter((membership) => membership.isDefault && membership.isActive),
    ["userId"]
  );
  for (const duplicate of defaultMemberships.slice(0, limit)) {
    pushIssue(warnings, "multiple-default-memberships", "Plusieurs memberships par défaut actifs pour un même utilisateur.", {
      ...duplicate.sample,
      count: duplicate.count,
    });
  }

  for (const membership of memberships) {
    if (membership.isActive && !membership.user?.isActive) {
      pushIssue(warnings, "inactive-user-membership", "Membership actif rattaché à un utilisateur inactif.", {
        membershipId: membership.id,
        companyId: membership.companyId,
        userId: membership.userId,
        email: membership.user?.email,
      });
    }
  }

  const activeMembershipsByCompany = new Map();
  for (const membership of memberships) {
    if (!membership.isActive) continue;
    activeMembershipsByCompany.set(
      membership.companyId,
      (activeMembershipsByCompany.get(membership.companyId) || 0) + 1
    );
  }
  for (const company of companies) {
    if ((activeMembershipsByCompany.get(company.id) || 0) === 0) {
      pushIssue(failures, "company-without-membership", "Société sans membership actif.", {
        companyId: company.id,
        companyName: company.name,
      });
    }
  }

  const transactionChecks = [
    ["account", "accountId", "account", "number"],
    ["invoice", "invoiceId", "invoice", "invoiceNumber"],
    ["client", "clientId", "client", "name"],
    ["supplier", "supplierId", "supplier", "name"],
    ["incomingInvoice", "incomingInvoiceId", "incomingInvoice", "entryNumber"],
    ["moneyMovement", "moneyMovementId", "moneyMovement", "voucherRef"],
    ["journalEntry", "journalEntryId", "journalEntry", "number"],
  ];
  for (const transaction of transactions) {
    for (const [relationName, idField, relationField, labelField] of transactionChecks) {
      const relationId = transaction[idField];
      const relation = transaction[relationField];
      if (!relationId || !relation?.companyId) continue;
      if (relation.companyId !== transaction.companyId) {
        pushIssue(
          failures,
          "cross-company-transaction",
          `Transaction liée à ${relationName} d'une autre société.`,
          {
            transactionId: transaction.id,
            transactionCompanyId: transaction.companyId,
            relation: relationName,
            relationId,
            relationCompanyId: relation.companyId,
            relationLabel: relation[labelField] ?? null,
          }
        );
      }
    }
  }

  for (const request of companyRequests) {
    if (request.status === "APPROVED") {
      if (!request.createdCompanyId || !request.reviewedByUserId || !request.reviewedAt) {
        pushIssue(failures, "approved-request-incomplete", "Demande approuvée incomplète.", {
          requestId: request.id,
          requestedName: request.requestedName,
          createdCompanyId: request.createdCompanyId,
          reviewedByUserId: request.reviewedByUserId,
          reviewedAt: request.reviewedAt,
        });
      }
      continue;
    }

    if (request.status === "PENDING" && (request.createdCompanyId || request.reviewedByUserId || request.reviewedAt)) {
      pushIssue(warnings, "pending-request-has-review-data", "Demande en attente avec traces de revue/création.", {
        requestId: request.id,
        requestedName: request.requestedName,
        createdCompanyId: request.createdCompanyId,
        reviewedByUserId: request.reviewedByUserId,
        reviewedAt: request.reviewedAt,
      });
    }
  }

  for (const user of users) {
    if (!user.companyId) continue;
    const hasMatchingMembership = memberships.some(
      (membership) => membership.userId === user.id && membership.companyId === user.companyId
    );
    if (!hasMatchingMembership) {
      pushIssue(warnings, "legacy-companyid-mismatch", "User.companyId legacy sans membership correspondant.", {
        userId: user.id,
        email: user.email,
        legacyCompanyId: user.companyId,
      });
    }
  }

  const report = {
    scope: companyId || "ALL",
    counts: {
      companies: companies.length,
      users: users.length,
      memberships: memberships.length,
      accounts: accounts.length,
      journalEntries: journalEntries.length,
      transactions: transactions.length,
      auditLogsSampled: auditLogs.length,
      companyRequests: companyRequests.length,
    },
    failures,
    warnings,
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("=== Multi-Company Isolation Test ===");
    console.log(`Scope: ${report.scope}`);
    console.log(
      `Counts: companies=${report.counts.companies} users=${report.counts.users} memberships=${report.counts.memberships} accounts=${report.counts.accounts} journals=${report.counts.journalEntries} transactions=${report.counts.transactions} requests=${report.counts.companyRequests}`
    );
    summarizeIssues("Failures", failures);
    summarizeIssues("Warnings", warnings.slice(0, limit));
  }

  process.exit(failures.length > 0 ? 1 : 0);
}

main()
  .catch((error) => {
    console.error("test-multi-company-isolation error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
