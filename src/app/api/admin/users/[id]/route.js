import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkPerm } from "@/lib/authz";
import bcrypt from "bcryptjs";
import { requireCompanyId } from "@/lib/tenant";
import { getRequestActor, getRequestRole } from "@/lib/requestAuth";

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
  const actor = await getRequestActor(req);
  const isPlatformAdmin = actor?.user?.role === "PLATFORM_ADMIN";
  const companyId = isPlatformAdmin ? null : requireCompanyId(req);
  const callerRole = await getRequestRole(req, companyId ? { companyId } : {});
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
  if (isPlatformAdmin && typeof body.canCreateCompany === "boolean") {
    updates.canCreateCompany = body.canCreateCompany;
  } else if (isPlatformAdmin && body.isActive === true) {
    const target = await prisma.user.findUnique({
      where: { id },
      select: { companyId: true, canCreateCompany: true },
    });
    if (target && !target.companyId && !target.canCreateCompany) {
      updates.canCreateCompany = true;
    }
  }
  if (body.password) {
    updates.password = await bcrypt.hash(body.password, 10);
  }
  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "Aucune donnee a mettre a jour" }, { status: 400 });
  }
  try {
    const user = await prisma.user.updateManyAndReturn({
      where: { id, ...(companyId ? { companyId } : {}) },
      data: updates,
      select: { id: true, email: true, username: true, role: true, isActive: true, canCreateCompany: true, createdAt: true, companyId: true },
    });
    return NextResponse.json({ ok: true, user: user[0] || null });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Update failed" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const actor = await getRequestActor(req);
  const isPlatformAdmin = actor?.user?.role === "PLATFORM_ADMIN";
  const companyId = isPlatformAdmin ? null : requireCompanyId(req);
  const callerRole = await getRequestRole(req, companyId ? { companyId } : {});
  if (!checkPerm("manageUsers", callerRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  try {
    await prisma.user.deleteMany({ where: { id, ...(companyId ? { companyId } : {}) } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Delete failed" }, { status: 500 });
  }
}
