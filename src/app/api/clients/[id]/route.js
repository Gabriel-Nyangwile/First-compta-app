// src/app/api/clients/[id]/route.js
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { normalizeEmail, validateCategory } from '@/lib/validation/client';

export async function GET(req, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 });
  const client = await prisma.client.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      address: true,
      category: true,
      accountId: true,
      account: {
        select: {
          id: true,
          number: true,
          label: true,
        },
      },
    },
  });
  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 });
  return NextResponse.json(client);
}

// DELETE /api/clients/[id]
export async function DELETE(req, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 });
  try {
    // Récupérer le client et son compte
    const client = await prisma.client.findUnique({
      where: { id },
      select: { accountId: true },
    });
    if (!client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 });
    }
    const accountId = client.accountId;
    // Supprimer le client
    await prisma.client.delete({ where: { id } });
    // Vérifier si le compte est orphelin (ni autre client ni supplier)
    if (accountId) {
      const [otherClients, otherSuppliers] = await Promise.all([
        prisma.client.count({ where: { accountId } }),
        prisma.supplier.count({ where: { accountId } }),
      ]);
      if (otherClients === 0 && otherSuppliers === 0) {
        // Vérifier aussi qu'il n'y a pas de transactions ou lignes de facture -> sécurité
        const [txCount, lineCount] = await Promise.all([
          prisma.transaction.count({ where: { accountId } }),
          prisma.invoiceLine.count({ where: { accountId } }),
        ]);
        if (txCount === 0 && lineCount === 0) {
          await prisma.account.delete({ where: { id: accountId } });
          return NextResponse.json({ success: true, deletedAccount: true });
        }
      }
    }
    return NextResponse.json({ success: true, deletedAccount: false });
  } catch (err) {
    console.error('DELETE /api/clients/[id] error', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PUT /api/clients/[id]
export async function PUT(req, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 });
  try {
    const body = await req.json();
  let { name, email, address, category, accountId } = body || {};
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
    }
    name = name.trim();
    email = normalizeEmail(email);
    // Vérifier existence du client cible
    const existing = await prisma.client.findUnique({ where: { id }, select: { id: true, email: true } });
    if (!existing) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 });
    }
    // Unicité email (ne pas compter soi-même)
    if (email) {
      const emailOwner = await prisma.client.findFirst({ where: { email } });
      if (emailOwner && emailOwner.id !== id) {
        return NextResponse.json({ error: 'Email déjà utilisé' }, { status: 409 });
      }
    }
    // Validation catégorie minimale
    category = validateCategory(category);
    // Vérifier compte si fourni
    let linkedAccountId = null;
    if (accountId) {
      const acc = await prisma.account.findUnique({ where: { id: accountId }, select: { id: true } });
      if (!acc) {
        return NextResponse.json({ error: 'Compte introuvable' }, { status: 400 });
      }
      linkedAccountId = acc.id;
    }
    const updated = await prisma.client.update({
      where: { id },
      data: {
        name,
        email,
        address: address && String(address).trim() !== '' ? String(address).trim() : null,
        category,
        accountId: linkedAccountId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        address: true,
        category: true,
        account: { select: { id: true, number: true, label: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('PUT /api/clients/[id] error', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
