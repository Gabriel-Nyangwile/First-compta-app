#!/usr/bin/env node
/**
 * Minimal seed: ensures an admin user and a primary bank money account exist.
 * Safe to run multiple times (idempotent where possible).
 */
import bcrypt from 'bcryptjs';
import prisma from '../src/lib/prisma.js';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'admin123';
const COMPANY_NAME = process.env.COMPANY_NAME || 'Entreprise Demo';

async function ensureCompany() {
  let company = await prisma.company.findFirst({ where: { name: COMPANY_NAME } });
  if (!company) {
    company = await prisma.company.create({ data: { name: COMPANY_NAME } });
    console.log(`Created company "${COMPANY_NAME}"`);
  } else {
    console.log(`Company "${COMPANY_NAME}" already exists.`);
  }
  return company;
}

async function ensureAdmin() {
  let user = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!user) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    user = await prisma.user.create({ data: { email: ADMIN_EMAIL, password: hash, role: 'SUPERADMIN', username: 'admin' } });
    console.log(`Created admin user ${ADMIN_EMAIL} (default password). Change it!`);
  } else {
    console.log('Admin user already exists.');
  }
  return user;
}

async function ensurePrimaryBank(companyId) {
  let ma = await prisma.moneyAccount.findFirst({ where: { label: 'Banque Principale', companyId } });
  if (!ma) {
    ma = await prisma.moneyAccount.create({ data: { type: 'BANK', label: 'Banque Principale', currency: 'EUR', openingBalance: 0, companyId } });
    console.log('Created money account Banque Principale');
  } else {
    console.log('Money account Banque Principale already exists.');
  }
  return ma;
}

async function main() {
  const company = await ensureCompany();
  await ensureAdmin();
  await ensurePrimaryBank(company.id);
  console.log('Minimal seed done.');
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error('Seed error:', e); await prisma.$disconnect(); process.exit(1); });
