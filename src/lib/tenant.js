// Simple tenant helper (dev-first). In prod, replace with session-based company resolution.

function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getCompanyIdFromRequest(req) {
  const headerId = req.headers.get('x-company-id');
  if (headerId) return headerId;
  const cookieId = readCookie(req.headers.get('cookie') || '', 'company-id');
  if (cookieId) return cookieId;
  const envId = (process.env.DEFAULT_COMPANY_ID || '').trim();
  return envId || null;
}

export function requireCompanyId(req) {
  const companyId = getCompanyIdFromRequest(req);
  if (!companyId) throw new Error('companyId requis');
  return companyId;
}

