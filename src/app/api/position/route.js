import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { toPlain } from '@/lib/json';

// GET: List all positions
export async function GET() {
  try {
    const positions = await prisma.position.findMany({
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
    const data = await request.json();
    const { title, description, baremeId } = data;
    const position = await prisma.position.create({
      data: { title, description, baremeId },
    });
    return NextResponse.json(toPlain({ position }));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
