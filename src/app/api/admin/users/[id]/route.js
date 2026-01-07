import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkPerm, getUserRole } from "@/lib/authz";
import bcrypt from "bcryptjs";

const allowedRoles = [
  "SUPERADMIN",
  "FINANCE_MANAGER",
  "ACCOUNTANT",
  "PROCUREMENT",
  "SALES",
  "HR_MANAGER",
  "PAYROLL_CLERK",
  "TREASURY",
  "VIEWER",
];

function normalizeRole(role) {
  const upper = role?.toString?.().toUpperCase().replace(/[\s-]+/g, "_");
  if (!upper) return "VIEWER";
  return allowedRoles.includes(upper) ? upper : null;
}

export async function PATCH(req, { params }) {
  const callerRole = await getUserRole(req);
  if (!checkPerm("manageUsers", callerRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const updates = {};
  if (body.role) {
    const norm = normalizeRole(body.role);
    if (!norm) return NextResponse.json({ error: "Role invalide" }, { status: 400 });
    updates.role = norm;
  }
  if (typeof body.isActive === "boolean") {
    updates.isActive = body.isActive;
  }
  if (body.password) {
    updates.password = await bcrypt.hash(body.password, 10);
  }
  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "Aucune donnée à mettre à jour" }, { status: 400 });
  }
  try {
    const user = await prisma.user.update({
      where: { id },
      data: updates,
      select: { id: true, email: true, username: true, role: true, isActive: true, createdAt: true },
    });
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Update failed" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const callerRole = await getUserRole(req);
  if (!checkPerm("manageUsers", callerRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Delete failed" }, { status: 500 });
  }
}
