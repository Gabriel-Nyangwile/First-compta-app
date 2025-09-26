// src/app/api/account/create/route.js
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

// POST /api/account/create
export async function POST(req) {
  const { number, label } = await req.json();
  if (!number || !label) {
    return NextResponse.json({ error: 'Numéro et libellé requis.' }, { status: 400 });
  }
  // Vérifier unicité
  const existing = await prisma.account.findUnique({ where: { number } });
  if (existing) {
    return NextResponse.json({ error: 'Ce numéro de compte existe déjà.' }, { status: 409 });
  }
  const account = await prisma.account.create({
    data: { number, label },
    select: { id: true, number: true, label: true },
  });
  return NextResponse.json(account);
}
