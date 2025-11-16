import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/health
// Renvoie un indicateur simple de disponibilité applicative + connectivité DB.
export async function GET() {
  const started = Date.now();
  let dbOk = false;
  let dbLatencyMs = null;
  try {
    const t0 = Date.now();
    // Requête très légère: compter les purchase orders (ou 0 si table vide)
    await prisma.purchaseOrder.count();
    dbLatencyMs = Date.now() - t0;
    dbOk = true;
  } catch (e) {
    dbOk = false;
  }
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    db: { ok: dbOk, latencyMs: dbLatencyMs },
    process: { pid: process.pid },
    responseTimeMs: Date.now() - started
  });
}

export const dynamic = 'force-dynamic';
