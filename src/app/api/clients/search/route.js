import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { requireCompanyId } from '@/lib/tenant';

export async function GET(req) {
  const companyId = requireCompanyId(req);
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query') || '';
  if (!query || query.length < 1) {
    return NextResponse.json([]);
  }
  // Recherche insensible à la casse sur le nom du client
  const clients = await prisma.client.findMany({
    where: {
      companyId,
      name: {
        contains: query,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      name: true,
    },
    take: 10,
  });
  return NextResponse.json(clients);
}
