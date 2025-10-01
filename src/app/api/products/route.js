import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/products?q=term&active=1
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const active = searchParams.get('active');
  const where = {};
  if (q) {
    where.OR = [
      { sku: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } }
    ];
  }
  if (active === '0') where.isActive = false; else if (active === '1') where.isActive = true;
  try {
    const products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' }
    });
    return NextResponse.json(products);
  } catch (e) {
    console.error('GET /products error', e);
    return NextResponse.json({ error: 'Erreur récupération produits.' }, { status: 500 });
  }
}

// POST /api/products { sku, name, description?, unit? }
export async function POST(request) {
  try {
    const body = await request.json();
    const sku = String(body.sku || '').trim();
    const name = String(body.name || '').trim();
    const description = body.description ? String(body.description) : undefined;
    const unit = body.unit ? String(body.unit) : undefined;
    if (!sku || !name) {
      return NextResponse.json({ error: 'sku et name requis.' }, { status: 400 });
    }
    const product = await prisma.product.create({
      data: { sku, name, description, unit }
    });
    return NextResponse.json(product, { status: 201 });
  } catch (e) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'SKU déjà utilisé.' }, { status: 409 });
    }
    console.error('POST /products error', e);
    return NextResponse.json({ error: 'Erreur création produit.' }, { status: 500 });
  }
}
