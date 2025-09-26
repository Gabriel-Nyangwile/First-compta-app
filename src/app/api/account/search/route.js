// src/app/api/account/search/route.js
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

// GET /api/account/search?query=411
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query') || '';
  if (!query || query.length < 1) {
    return NextResponse.json([]);
  }
  // Limiter à 10 résultats max
  const accounts = await prisma.account.findMany({
    where: {
      number: {
        startsWith: query,
      },
    },
    orderBy: { number: 'asc' },
    take: 10,
    select: {
      id: true,
      number: true,
      label: true,
    },
  });
  return NextResponse.json(accounts);
}
