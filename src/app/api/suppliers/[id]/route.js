import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { normalizeEmail } from '@/lib/validation/client';
import { requireCompanyId } from '@/lib/tenant';

// GET /api/suppliers/:id
export async function GET(_req, { params }) {
  const companyId = requireCompanyId(_req);
  const { id } = params;
  const supplier = await prisma.supplier.findUnique({
    where: { id, companyId },
    select: {
      id: true,
      name: true,
      email: true,
      address: true,
      phone: true,
      account: { select: { id: true, number: true, label: true } }
    }
  });
  if (!supplier) return NextResponse.json({ error: 'Fournisseur introuvable' }, { status: 404 });
  return NextResponse.json(supplier);
}

// PUT /api/suppliers/:id
export async function PUT(req, { params }) {
  try {
    const companyId = requireCompanyId(req);
    const { id } = params;
    const body = await req.json();
    let { name, email, address, phone, accountId } = body || {};

    const existing = await prisma.supplier.findUnique({ where: { id, companyId } });
    if (!existing) return NextResponse.json({ error: 'Fournisseur introuvable' }, { status: 404 });

    if (name) name = name.trim();
    email = normalizeEmail(email);

    let linkedAccountId = null;
    if (accountId) {
      const acc = await prisma.account.findUnique({ where: { id: accountId, companyId }, select: { id: true } });
      if (!acc) return NextResponse.json({ error: 'Compte introuvable' }, { status: 400 });
      linkedAccountId = acc.id;
    }

    if (email) {
      const dup = await prisma.supplier.findFirst({ where: { email, companyId, NOT: { id } } });
      if (dup) return NextResponse.json({ error: 'Email déjà utilisé' }, { status: 409 });
    }

    const updated = await prisma.supplier.update({
      where: { id, companyId },
      data: {
        name: name ?? existing.name,
        email: email ?? null,
        address: address !== undefined ? (address && String(address).trim() !== '' ? String(address).trim() : null) : existing.address,
        phone: phone !== undefined ? (phone && String(phone).trim() !== '' ? String(phone).trim() : null) : existing.phone,
        accountId: accountId !== undefined ? linkedAccountId : existing.accountId
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
    return NextResponse.json(updated);
  } catch (e) {
    console.error('PUT /api/suppliers/:id error', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE /api/suppliers/:id
export async function DELETE(_req, { params }) {
  const companyId = requireCompanyId(_req);
  const { id } = params;
  // Vérifier factures reçues ou transactions liées avant suppression (simplifié: si incomingInvoices existent, blocage)
  const used = await prisma.incomingInvoice.findFirst({ where: { supplierId: id, companyId }, select: { id: true } });
  if (used) return NextResponse.json({ error: 'Fournisseur lié à des factures reçues' }, { status: 400 });
  await prisma.supplier.delete({ where: { id, companyId } });
  return NextResponse.json({ ok: true });
}
