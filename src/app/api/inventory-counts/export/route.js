import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireInventoryPermission } from "@/app/api/_lib/auth";
import { requireCompanyId } from "@/lib/tenant";

function toNumber(value) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
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

function csvEscape(value) {
  if (value == null) return "";
  const str = String(value);
  if (/[",;\n]/.test(str)) {
    return "\"" + str.replace(/"/g, '""') + "\"";
  }
  return str;
}

export async function GET(request) {
  try {
    requireInventoryPermission(request);
    const companyId = requireCompanyId(request);
    const counts = await prisma.inventoryCount.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
      include: {
        lines: {
          orderBy: { product: { sku: "asc" } },
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
              },
            },
          },
        },
        createdBy: { select: { username: true, email: true } },
      },
    });

    const header = [
      "Inventaire",
      "Statut",
      "Compté le",
      "Posté le",
      "Produit",
      "SKU",
      "SnapshotQty",
      "CountedQty",
      "DeltaQty",
      "DeltaValue",
    ];

    const rows = [header.join(";")];

    for (const count of counts) {
      for (const line of count.lines || []) {
        rows.push([
          csvEscape(count.number),
          csvEscape(count.status),
          csvEscape(count.countedAt?.toISOString?.() ?? ""),
          csvEscape(count.postedAt?.toISOString?.() ?? ""),
          csvEscape(line.product?.name || ""),
          csvEscape(line.product?.sku || ""),
          toNumber(line.snapshotQty).toFixed(3),
          line.countedQty == null ? "" : toNumber(line.countedQty).toFixed(3),
          line.deltaQty == null ? "" : toNumber(line.deltaQty).toFixed(3),
          line.deltaValue == null ? "" : toNumber(line.deltaValue).toFixed(2),
        ].join(";"));
      }
    }

    const csvContent = rows.join("\n");
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"inventory_counts.csv\"",
      },
    });
  } catch (error) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Accès inventaire restreint." },
        { status: 401 }
      );
    }
    console.error("GET /inventory-counts/export error", error);
    return NextResponse.json(
      { error: "Erreur export inventaire." },
      { status: 500 }
    );
  }
}
