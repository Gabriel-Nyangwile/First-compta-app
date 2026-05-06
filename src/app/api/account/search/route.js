// src/app/api/account/search/route.js
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { requireCompanyId } from '@/lib/tenant';

// GET /api/account/search?query=411
export async function GET(req) {
  const companyId = requireCompanyId(req);
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query') || '';
  const limit = Math.min(
    100,
    Math.max(10, Number.parseInt(searchParams.get('limit') || '50', 10) || 50)
  );
  if (!query || query.length < 1) {
    return NextResponse.json([]);
  }
  const accounts = await prisma.account.findMany({
    where: {
      companyId,
      number: {
        startsWith: query,
      },
    },
    orderBy: { number: 'asc' },
    take: limit,
    select: {
      id: true,
      number: true,
      label: true,
    },
  });
  return NextResponse.json(accounts);
}
