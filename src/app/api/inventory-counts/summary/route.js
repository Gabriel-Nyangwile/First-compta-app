import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireInventoryPermission } from '@/app/api/_lib/auth';
import { requireCompanyId } from '@/lib/tenant';

function toNumber(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (value?.toNumber) {
    try {
      return value.toNumber();
    } catch {
      return Number(value) || 0;
    }
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request) {
  try {
    requireInventoryPermission(request);
    const companyId = requireCompanyId(request);
    const counts = await prisma.inventoryCount.findMany({
      where: { companyId },
      include: {
        lines: {
          select: {
            countedQty: true,
            snapshotQty: true,
            deltaQty: true,
            deltaValue: true,
            status: true,
          },
        },
      },
    });

    const summary = {
      totalCounts: counts.length,
      draft: 0,
      completed: 0,
      posted: 0,
      cancelled: 0,
      totalDeltaQty: 0,
      totalDeltaValue: 0,
    };

    for (const count of counts) {
      const statusKey = (count.status || 'DRAFT').toLowerCase();
      summary[statusKey] = (summary[statusKey] || 0) + 1;

      for (const line of count.lines || []) {
        const deltaQty =
          line.countedQty == null
            ? 0
            : toNumber(line.countedQty) - toNumber(line.snapshotQty);
        summary.totalDeltaQty += deltaQty;
        summary.totalDeltaValue += toNumber(line.deltaValue || 0);
      }
    }

    summary.totalDeltaQty = Number(summary.totalDeltaQty.toFixed(3));
    summary.totalDeltaValue = Number(summary.totalDeltaValue.toFixed(2));

    return NextResponse.json(summary);
  } catch (error) {
    if (error?.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { error: 'Accès inventaire restreint.' },
        { status: 401 }
      );
    }
    console.error('GET /inventory-counts/summary error', error);
    return NextResponse.json(
      { error: 'Erreur récupération synthèse inventaire.' },
      { status: 500 }
    );
  }
}

