import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { normalizeEmail, validateCategory } from '@/lib/validation/client';

export async function GET() {
  // Retourne tous les clients avec leur compte associé
  const clients = await prisma.client.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      address: true,
      account: {
        select: {
          id: true,
          number: true,
          label: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({ clients });
}

// POST /api/clients
export async function POST(req) {
  try {
    const body = await req.json();
  let { name, email, accountId, category, address } = body || {};
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
    }
    name = name.trim();
    // Normalisation email
    email = normalizeEmail(email);
    // Vérifier unicité email si fourni (normalisé)
    if (email) {
      const existingEmail = await prisma.client.findFirst({ where: { email } });
      if (existingEmail) {
        return NextResponse.json({ error: 'Email déjà utilisé' }, { status: 409 });
      }
    }
    // Vérifier compte si fourni
    let linkedAccount = null;
    if (accountId) {
      linkedAccount = await prisma.account.findUnique({ where: { id: accountId }, select: { id: true, number: true, label: true } });
      if (!linkedAccount) {
        return NextResponse.json({ error: 'Compte introuvable' }, { status: 400 });
      }
    }
    const client = await prisma.client.create({
      data: {
        name,
        email, // peut être null
        accountId: linkedAccount ? linkedAccount.id : null,
        category: validateCategory(category),
        address: address && String(address).trim() !== '' ? String(address).trim() : null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        address: true,
        account: { select: { id: true, number: true, label: true } },
        category: true,
      },
    });
    return NextResponse.json(client, { status: 201 });
  } catch (err) {
    console.error('POST /api/clients error', err);
    // Conflits potentiels (ex: contrainte unique) remontent ici aussi
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
