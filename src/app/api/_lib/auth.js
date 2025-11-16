export function getApiToken(request) {
  return request.headers.get("x-admin-token");
}

export function requireInventoryPermission(request) {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return true;
  const headerToken = getApiToken(request);
  if (headerToken !== adminToken) {
    const error = new Error("UNAUTHORIZED");
    error.statusCode = 401;
    throw error;
  }
  return true;
}
