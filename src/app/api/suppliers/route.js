import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { normalizeEmail } from '@/lib/validation/client';

/*
  GET /api/suppliers
  Retourne la liste des fournisseurs (tri alpha)
*/
export async function GET() {
  // Récupération de base
  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      address: true,
      phone: true,
      account: { select: { id: true, number: true, label: true } }
    }
  });

  // Récupérer agrégats sur les factures reçues (incomingInvoices)
  const agg = await prisma.incomingInvoice.groupBy({
    by: ['supplierId'],
    _count: { id: true },
    _sum: { totalAmount: true }
  });
  const map = new Map();
  agg.forEach(a => {
    if (!a.supplierId) return;
    map.set(a.supplierId, { incomingCount: a._count.id, incomingTotal: a._sum.totalAmount });
  });
  const enriched = suppliers.map(s => {
    const extra = map.get(s.id) || { incomingCount: 0, incomingTotal: 0 };
    return { ...s, incomingInvoicesCount: extra.incomingCount, incomingInvoicesTotal: extra.incomingTotal };
  });
  return NextResponse.json({ suppliers: enriched });
}

/*
  POST /api/suppliers
  Body: { name, email?, address?, phone?, accountId? }
  - email optionnel, normalisé
  - si accountId fourni, doit exister
  - création possible sans compte (on pourra l'associer plus tard)
  - email n'est pas unique globalement chez Supplier (contrairement aux clients) -> mais on peut décider de vérifier duplication simple
*/
export async function POST(req) {
  try {
    const body = await req.json();
    let { name, email, address, phone, accountId } = body || {};
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
    }
    name = name.trim();
    email = normalizeEmail(email); // peut retourner null

    let linkedAccountId = null;
    if (accountId) {
      const acc = await prisma.account.findUnique({ where: { id: accountId }, select: { id: true } });
      if (!acc) return NextResponse.json({ error: 'Compte introuvable' }, { status: 400 });
      linkedAccountId = acc.id;
    }

    // Tolérance: on n'impose pas l'unicité email, mais on peut prévenir l'utilisateur si duplicat exact
    if (email) {
      const existing = await prisma.supplier.findFirst({ where: { email } });
      if (existing) {
        // On retourne quand même 409 pour signaler doublon volontairement
        return NextResponse.json({ error: 'Email déjà utilisé par un autre fournisseur' }, { status: 409 });
      }
    }

    const supplier = await prisma.supplier.create({
      data: {
        name,
        email,
        address: address && String(address).trim() !== '' ? String(address).trim() : null,
        phone: phone && String(phone).trim() !== '' ? String(phone).trim() : null,
        accountId: linkedAccountId
      },
      select: {
        id: true,
        name: true,
        email: true,
        address: true,
        phone: true,
        account: { select: { id: true, number: true, label: true } }
      }
    });
    return NextResponse.json(supplier, { status: 201 });
  } catch (e) {
    console.error('POST /api/suppliers error', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
