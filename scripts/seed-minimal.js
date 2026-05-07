#!/usr/bin/env node
/**
 * Minimal seed: ensures a default company, an admin user, and a primary bank
 * money account exist. Safe to run multiple times (idempotent where possible).
 */
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import prisma from '../src/lib/prisma.js';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'admin123';
const DEFAULT_COMPANY_NAME = process.env.SEED_COMPANY_NAME || 'Société par défaut';
const HAS_SUPERADMIN_ROLE = Object.prototype.hasOwnProperty.call(UserRole, 'SUPERADMIN');
const ADMIN_ROLE = UserRole.SUPERADMIN;

if (!HAS_SUPERADMIN_ROLE || ADMIN_ROLE === undefined) {
  throw new Error(
    `UserRole.SUPERADMIN is not defined in generated Prisma Client. Available roles: ${Object.keys(UserRole || {}).join(', ')}`
  );
}

async function ensureDefaultCompany() {
  let company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!company) {
    company = await prisma.company.create({ data: { name: DEFAULT_COMPANY_NAME, currency: 'XOF' } });
    console.log(`Created default company "${DEFAULT_COMPANY_NAME}".`);
  } else {
    console.log(`Default company already exists: "${company.name}".`);
  }
  return company;
}

async function ensureAdmin(company) {
  let user = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!user) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    user = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        password: hash,
        role: ADMIN_ROLE,
        username: 'admin',
        companyId: company.id,
      },
    });
    console.log(`Created admin user ${ADMIN_EMAIL} (default password). Change it!`);
  } else {
    console.log('Admin user already exists.');
  }
  // Ensure the admin has a membership in the default company
  const existing = await prisma.companyMembership.findUnique({
    where: { companyId_userId: { companyId: company.id, userId: user.id } },
  });
  if (!existing) {
    await prisma.companyMembership.create({
      data: { companyId: company.id, userId: user.id, role: ADMIN_ROLE, isDefault: true },
    });
    console.log(`Created ${ADMIN_ROLE} membership for ${ADMIN_EMAIL}.`);
  }
  return user;
}

async function ensurePrimaryBank(company) {
  let ma = await prisma.moneyAccount.findFirst({ where: { companyId: company.id, label: 'Banque Principale' } });
  if (!ma) {
    ma = await prisma.moneyAccount.create({
      data: { companyId: company.id, type: 'BANK', label: 'Banque Principale', currency: 'EUR', openingBalance: 0 },
    });
    console.log('Created money account Banque Principale');
  } else {
    console.log('Money account Banque Principale already exists.');
  }
  return ma;
}

async function main() {
  const company = await ensureDefaultCompany();
  await ensureAdmin(company);
  await ensurePrimaryBank(company);
  console.log('Minimal seed done.');
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error('Seed error:', e); await prisma.$disconnect(); process.exit(1); });
