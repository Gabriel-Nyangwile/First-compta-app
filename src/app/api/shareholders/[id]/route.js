import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(req, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  try {
    const body = await req.json();
    const { name, type, email, phone, address } = body;
    const sh = await prisma.shareholder.update({
      where: { id },
      data: {
        name: name ?? undefined,
        type: type ?? undefined,
        email: email ?? undefined,
        phone: phone ?? undefined,
        address: address ?? undefined,
      },
    });
    return NextResponse.json(sh);
  } catch (e) {
    const msg = e.message || "Erreur mise à jour actionnaire";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  try {
    await prisma.shareholder.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e.message || "Erreur suppression actionnaire";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
