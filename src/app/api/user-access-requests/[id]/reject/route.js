import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkPerm } from "@/lib/authz";
import { getRequestActor, getRequestRole } from "@/lib/requestAuth";
import { reviewVisibleAfter } from "@/lib/accessReview";

export async function POST(req, { params }) {
  const actor = await getRequestActor(req);
  if (!actor?.userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const role = await getRequestRole(req);
  if (!checkPerm("manageUsers", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const note = body?.reviewNote?.toString?.().trim() || "Rejected";
  const now = new Date();

  try {
    const request = await prisma.userAccessRequest.findUnique({ where: { id } });
    if (!request) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
    if (request.status !== "PENDING") {
      return NextResponse.json({ error: "Seules les demandes PENDING peuvent être rejetées" }, { status: 400 });
    }
    if (role === "SUPERADMIN" && actor.companyId !== request.companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.userAccessRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedByUserId: actor.userId,
        reviewedAt: now,
        visibleAfterAt: reviewVisibleAfter(now),
        reviewNote: note,
      },
      include: {
        requesterUser: { select: { id: true, email: true, username: true } },
        company: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ request: updated });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Reject failed" }, { status: 400 });
  }
}
