import { NextResponse } from "next/server";
import { requireCompanyId } from "@/lib/tenant";
import { runOpeningImport } from "@/lib/opening/importers";

export async function POST(request, { params }) {
  try {
    const companyId = requireCompanyId(request);
    const { kind } = await params;
    const form = await request.formData();
    const file = form.get("file");
    const openingDate = String(form.get("openingDate") || "").trim();
    const sheetName = String(form.get("sheetName") || "").trim() || null;
    const mode = String(form.get("mode") || "dry-run").trim();
    const dryRun = mode !== "import";

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json(
        { ok: false, error: "Fichier Excel requis." },
        { status: 400 }
      );
    }
    if (!openingDate) {
      return NextResponse.json(
        { ok: false, error: "Date d'ouverture requise." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const report = await runOpeningImport({
      kind,
      buffer,
      sheetName,
      companyId,
      openingDate,
      dryRun,
    });

    return NextResponse.json(report, { status: dryRun ? 200 : 201 });
  } catch (error) {
    console.error("POST /api/opening/[kind] error", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Erreur import ouverture" },
      { status: 400 }
    );
  }
}
