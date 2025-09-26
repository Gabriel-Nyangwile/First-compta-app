import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/suppliers/search?q=term  (recherche simple par nom ou email)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (!q) return NextResponse.json({ suppliers: [] });
  const suppliers = await prisma.supplier.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } }
      ]
    },
    take: 20,
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true }
  });
  return NextResponse.json({ suppliers });
}
