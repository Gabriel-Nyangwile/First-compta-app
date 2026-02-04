import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCompanyId } from '@/lib/tenant';

// GET /api/accounts?q= | prefix=
// Simple listing used for auto-fill (id, number, label)
export async function GET(request) {
  try {
    const companyId = requireCompanyId(request);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const prefix = searchParams.get('prefix');
    const where = { companyId };
    if (q) {
      where.OR = [
        { number: { contains: q } },
        { label: { contains: q, mode: 'insensitive' } }
      ];
    }
    if (prefix) {
      where.number = { startsWith: prefix };
    }
    const accounts = await prisma.account.findMany({
      where,
      orderBy: { number: 'asc' },
      select: { id: true, number: true, label: true }
    });
    return NextResponse.json(accounts);
  } catch (e) {
    console.error('GET /api/accounts error', e);
    return NextResponse.json({ error: 'Erreur récupération comptes.' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
