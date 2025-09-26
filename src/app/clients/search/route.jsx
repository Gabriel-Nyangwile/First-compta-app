// src/app/api/clients/search/route.js
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

// GET /api/clients/search?query=411
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query') || '';
  if (!query || query.length < 1) {
    return NextResponse.json([]);
  }
  // Limiter à 10 résultats max
  const clients = await prisma.client.findMany({
    where: {
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
}
