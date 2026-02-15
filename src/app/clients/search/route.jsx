// src/app/api/clients/search/route.js
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { requireCompanyId } from '@/lib/tenant';

// GET /api/clients/search?query=411
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query') || '';
    if (!query || query.length < 1) {
      return NextResponse.json([]);
    }
    const companyId = requireCompanyId(req);
    // Limiter à 10 résultats max
    const clients = await prisma.client.findMany({
      where: {
        companyId,
        name: {
          startsWith: query,
        },
      },
      orderBy: { name: 'asc' },
      take: 10,
      select: {
        id: true,
        number: true,
        label: true,
      },
    });
    return NextResponse.json(clients);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
