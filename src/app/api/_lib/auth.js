export function getApiToken(request) {
  return request.headers.get("x-admin-token");
}

export function requireInventoryPermission(request) {
  // Dev/test bypass: when AUTH_DISABLED is set to '1' or 'true', skip auth checks
  const disabled = (process.env.AUTH_DISABLED || "").toLowerCase() === "1" ||
    (process.env.AUTH_DISABLED || "").toLowerCase() === "true";
  if (disabled) return true;

  const adminToken = process.env.ADMIN_TOKEN;
  const publicToken = process.env.NEXT_PUBLIC_ADMIN_TOKEN;
  if (!adminToken && !publicToken) return true;
  const headerToken = getApiToken(request);
  const ok = (adminToken && headerToken === adminToken) || (publicToken && headerToken === publicToken);
  if (!ok) {
    const error = new Error("UNAUTHORIZED");
    error.statusCode = 401;
    throw error;
  }
  return true;
}
