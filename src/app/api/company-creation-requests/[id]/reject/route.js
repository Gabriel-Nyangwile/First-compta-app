import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkPerm } from "@/lib/authz";
import { getRequestActor, getRequestRole } from "@/lib/requestAuth";
import { reviewVisibleAfter } from "@/lib/accessReview";

export async function POST(req, { params }) {
  const actor = await getRequestActor(req);
  const role = await getRequestRole(req);
  if (!actor?.userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!checkPerm("createCompany", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const body = await req.json().catch(() => ({}));

  try {
    const request = await prisma.companyCreationRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedByUserId: actor.userId,
        reviewedAt: new Date(),
        visibleAfterAt: reviewVisibleAfter(),
        reviewNote: body?.reviewNote?.toString?.().trim() || "Rejected",
      },
    });
    return NextResponse.json({ request });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Reject failed" }, { status: 400 });
  }
}
