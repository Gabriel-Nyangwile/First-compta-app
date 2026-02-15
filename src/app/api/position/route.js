import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { toPlain } from '@/lib/json';
import { requireCompanyId } from '@/lib/tenant';

// GET: List all positions
export async function GET(request) {
  try {
    const companyId = requireCompanyId(request);
    const positions = await prisma.position.findMany({
      where: { companyId },
      include: { bareme: true },
      orderBy: { createdAt: 'desc' },
    });
  return NextResponse.json(toPlain({ positions }));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create a new position
export async function POST(request) {
  try {
    const companyId = requireCompanyId(request);
    const data = await request.json();
    const { title, description, baremeId } = data;
    const position = await prisma.position.create({
      data: { companyId, title, description, baremeId },
    });
    return NextResponse.json(toPlain({ position }));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
