import prisma from "@/lib/prisma";
import { getUserRole, normalizeRole } from "@/lib/authz";
import { getCompanyIdFromRequest } from "@/lib/tenant";

function readCookieHeader(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getUserIdFromRequest(req) {
  const headerId = req.headers.get("x-user-id") || req.headers.get("x-userid");
  if (headerId) return headerId;

  const cookieHeader = req.headers.get("cookie") || "";
  return (
    readCookieHeader(cookieHeader, "user-id") ||
    readCookieHeader(cookieHeader, "userId") ||
    readCookieHeader(cookieHeader, "user_id") ||
    null
  );
}

export async function getRequestActor(req, options = {}) {
  const requestedCompanyId = options.companyId ?? getCompanyIdFromRequest(req);
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return {
      userId: null,
      user: null,
      membership: null,
      companyId: requestedCompanyId || null,
      role: null,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        where: { isActive: true },
        include: {
          company: { select: { id: true, name: true } },
        },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!user) {
    return {
      userId,
      user: null,
      membership: null,
      companyId: requestedCompanyId || null,
      role: null,
    };
  }

  const fallbackMembership =
    user.memberships.find((item) => item.companyId === user.companyId) ||
    user.memberships.find((item) => item.isDefault) ||
    user.memberships[0] ||
    null;

  const membership = requestedCompanyId
    ? user.memberships.find((item) => item.companyId === requestedCompanyId) || null
    : fallbackMembership;

  const effectiveCompanyId =
    membership?.companyId ||
    (requestedCompanyId && user.companyId === requestedCompanyId ? requestedCompanyId : null) ||
    fallbackMembership?.companyId ||
    user.companyId ||
    null;

  const effectiveRole =
    membership?.role ||
    (requestedCompanyId && user.companyId === requestedCompanyId ? user.role : null) ||
    fallbackMembership?.role ||
    user.role ||
    null;

  return {
    userId: user.id,
    user,
    membership,
    companyId: effectiveCompanyId,
    role: normalizeRole(effectiveRole),
  };
}

export async function getRequestRole(req, options = {}) {
  const actor = await getRequestActor(req, options);
  if (actor.role) return actor.role;
  return getUserRole(req);
}
