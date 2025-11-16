import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { toPlain } from '@/lib/json';

// GET: List all baremes
export async function GET() {
  try {
    const baremes = await prisma.bareme.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(toPlain({ baremes }));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create a new bareme
export async function POST(request) {
  try {
    const data = await request.json();
    const { category, categoryDescription, tension, legalSalary } = data;
    if (!category || typeof category !== 'string') {
      return NextResponse.json({ error: 'Category requis' }, { status: 400 });
    }
    if (!categoryDescription || typeof categoryDescription !== 'string') {
      return NextResponse.json({ error: 'categoryDescription requis' }, { status: 400 });
    }
    const parsedSalary = legalSalary != null ? Number(legalSalary) : null;
    if (parsedSalary == null || Number.isNaN(parsedSalary)) {
      return NextResponse.json({ error: 'legalSalary invalide' }, { status: 400 });
    }
    const bareme = await prisma.bareme.create({
      data: {
        category: category.trim(),
        categoryDescription: categoryDescription.trim(),
        tension: typeof tension === 'string' && tension.trim().length ? tension.trim() : undefined,
        legalSalary: parsedSalary,
      },
    });
    return NextResponse.json(toPlain({ bareme }));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
