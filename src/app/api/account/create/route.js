// src/app/api/account/create/route.js
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { requireCompanyId } from '@/lib/tenant';

// POST /api/account/create
export async function POST(req) {
  const companyId = requireCompanyId(req);
  const { number, label } = await req.json();
  if (!number || !label) {
    return NextResponse.json({ error: 'Numéro et libellé requis.' }, { status: 400 });
  }
  // Vérifier unicité
  const existing = await prisma.account.findUnique({ where: { companyId_number: { companyId, number } } });
  if (existing) {
    return NextResponse.json({ error: 'Ce numéro de compte existe déjà.' }, { status: 409 });
  }
  const account = await prisma.account.create({
    data: { companyId, number, label },
    select: { id: true, number: true, label: true },
  });
  return NextResponse.json(account);
}
