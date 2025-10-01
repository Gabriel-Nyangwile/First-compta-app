import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(_req, { params }) {
  const p = await params; // Next 15 async params support
  const { id } = p;
  try {
    const body = await _req.json();
    const data = {};
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
    if (!Object.keys(data).length) return NextResponse.json({ error: 'Aucune mise à jour.' }, { status: 400 });
    const updated = await prisma.product.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (e) {
    console.error('PATCH /api/products/[id]', e);
    return NextResponse.json({ error: 'Erreur mise à jour produit.' }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  const p = await params;
  const { id } = p;
  try {
    // Attempt delete; will throw if FK constraints
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2003' || e.code === 'P2014') {
      return NextResponse.json({ error: 'Produit référencé; désactivez-le à la place.' }, { status: 409 });
    }
    console.error('DELETE /api/products/[id]', e);
    return NextResponse.json({ error: 'Erreur suppression produit.' }, { status: 500 });
  }
}
