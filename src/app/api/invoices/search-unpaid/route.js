import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { Decimal } from '@prisma/client/runtime/library';

// GET /api/invoices/search-unpaid?query=...&limit=20
// Retourne les factures client non soldées (PENDING ou PARTIAL)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('query')?.trim() || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '40', 10), 100);
    const rows = await prisma.$queryRaw`
      SELECT i."id", i."invoiceNumber", i."issueDate",
             i."totalAmount", i."status", i."paidAmount", i."outstandingAmount",
             c."name" AS "clientName"
      FROM "Invoice" i
      LEFT JOIN "Client" c ON c."id" = i."clientId"
      WHERE i."status" IN ('PENDING','PARTIAL','OVERDUE')
      ORDER BY i."issueDate" DESC
      LIMIT ${Math.min(limit * 5, 500)}
    `;

    const normalize = (value) =>
      value
        ? value
            .toString()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .toLowerCase()
        : '';

    const needle = normalize(q);
    // Regex pour les deux formats : INV-xxxx et Numero-yyyy/xxxx
    const formatRegex = /^(inv-\d{4,}|\d+-\d{4}\/\d{4,})$/i;
    const filtered = needle
      ? rows.filter((r) => {
          const number = normalize(r.invoiceNumber);
          const clientName = normalize(r.clientName);
          // Recherche classique + match regex format
          return (
            number.includes(needle) ||
            clientName.includes(needle) ||
            formatRegex.test(number)
          );
        })
      : rows;

    const sliced = filtered.slice(0, limit);

    const result = sliced.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      issueDate: r.issueDate,
      totalAmount: r.totalAmount instanceof Decimal ? r.totalAmount.toNumber() : Number(r.totalAmount || 0),
      status: r.status,
      paidAmount: r.paidAmount instanceof Decimal ? r.paidAmount.toNumber() : Number(r.paidAmount || 0),
      outstandingAmount:
        r.outstandingAmount instanceof Decimal
          ? r.outstandingAmount.toNumber()
          : Number(r.outstandingAmount != null ? r.outstandingAmount : 0),
      client: { name: r.clientName },
    }));

    return NextResponse.json(
      result.map((r) => ({
        ...r,
        paid: r.paidAmount,
        remaining:
          r.outstandingAmount != null
            ? r.outstandingAmount
            : r.totalAmount - r.paidAmount,
      }))
    );
  } catch (e) {
    console.error('search-unpaid invoices error', e);
    return NextResponse.json({ error: 'Erreur recherche factures impayées' }, { status: 500 });
  }
}
