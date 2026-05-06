import { NextResponse } from "next/server";
import {
  buildOpeningTemplateBuffer,
  getOpeningTemplateDefinition,
} from "@/lib/opening/templates";

export async function GET(_request, { params }) {
  try {
    const { kind } = await params;
    const definition = getOpeningTemplateDefinition(kind);
    if (!definition) {
      return NextResponse.json(
        { ok: false, error: "Template inconnu" },
        { status: 404 }
      );
    }
    const buffer = await buildOpeningTemplateBuffer(kind);
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${definition.fileName}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/opening/templates/[kind] error", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Erreur generation template" },
      { status: 500 }
    );
  }
}
