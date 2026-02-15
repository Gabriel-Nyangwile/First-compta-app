// Simple tenant helper (dev-first). In prod, replace with session-based company resolution.

function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getCompanyIdFromRequest(req) {
  const headerId = req.headers.get('x-company-id') || req.headers.get('x-companyid');
  if (headerId) return headerId;

  const cookieHeader = req.headers.get('cookie') || '';
  const cookieId =
    readCookie(cookieHeader, 'company-id') ||
    readCookie(cookieHeader, 'companyId') ||
    readCookie(cookieHeader, 'company_id');
  if (cookieId) return cookieId;

  const envId = (process.env.DEFAULT_COMPANY_ID || '').trim();
  return envId || null;
}

export function getCompanyIdFromCookies(cookieStore) {
  if (!cookieStore) return (process.env.DEFAULT_COMPANY_ID || '').trim() || null;
  const direct =
    cookieStore.get?.('company-id')?.value ||
    cookieStore.get?.('companyId')?.value ||
    cookieStore.get?.('company_id')?.value;
  if (direct) return direct;
  const envId = (process.env.DEFAULT_COMPANY_ID || '').trim();
  return envId || null;
}

export function requireCompanyId(req) {
  const companyId = getCompanyIdFromRequest(req);
  if (!companyId) {
    throw new Error('companyId requis (cookie company-id ou header x-company-id, ou DEFAULT_COMPANY_ID)');
  }
  return companyId;
}
