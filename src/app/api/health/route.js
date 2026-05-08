import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/health
// Renvoie un indicateur simple de disponibilité applicative + connectivité DB.
export async function GET() {
  const started = Date.now();
  let dbOk = false;
  let dbLatencyMs = null;
  let dbError = null;
  try {
    const t0 = Date.now();
    // Requête très légère: compter les purchase orders (ou 0 si table vide)
    await prisma.purchaseOrder.count();
    dbLatencyMs = Date.now() - t0;
    dbOk = true;
  } catch (e) {
    dbOk = false;
    dbError = {
      code: e?.code || e?.name || "DB_ERROR",
      message: e?.message?.split("\n")[0] || "Database check failed",
    };
  }
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    db: { ok: dbOk, latencyMs: dbLatencyMs, error: dbError },
    process: { pid: process.pid },
    responseTimeMs: Date.now() - started
  });
}

export const dynamic = 'force-dynamic';
