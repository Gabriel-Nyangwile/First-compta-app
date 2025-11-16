import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { toPlain } from '@/lib/json';

// GET: Get bareme by ID
export async function GET(request, ctx) {
  try {
    const { id } = await ctx.params;
    const bareme = await prisma.bareme.findUnique({ where: { id } });
    if (!bareme) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(toPlain({ bareme }));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Update bareme by ID
export async function PUT(request, ctx) {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const data = {};
    if (typeof body.category === 'string') data.category = body.category.trim();
    if (typeof body.categoryDescription !== 'undefined') {
      // Enforce non-empty categoryDescription via API even if DB allows NULL
      if (body.categoryDescription == null) {
        return NextResponse.json({ error: 'categoryDescription requis' }, { status: 400 });
      }
      const d = String(body.categoryDescription).trim();
      if (!d.length) {
        return NextResponse.json({ error: 'categoryDescription requis' }, { status: 400 });
      }
      data.categoryDescription = d;
    }
    if (typeof body.tension !== 'undefined') {
      const t = (body.tension ?? '').toString().trim();
      data.tension = t.length ? t : null;
    }
    if (typeof body.legalSalary !== 'undefined') {
      const n = Number(body.legalSalary);
      if (Number.isNaN(n)) return NextResponse.json({ error: 'legalSalary invalide' }, { status: 400 });
      data.legalSalary = n;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Aucun champ valide à mettre à jour' }, { status: 400 });
    }
    const bareme = await prisma.bareme.update({ where: { id }, data });
    return NextResponse.json(toPlain({ bareme }));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// DELETE: Delete bareme by ID
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    await prisma.bareme.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
