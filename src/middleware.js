import { NextResponse } from 'next/server';

const protectedPatterns = [
  /^\/api\/products$/,
  /^\/api\/purchase-orders/,
  /^\/api\/goods-receipts/,
  /^\/api\/stock-adjustments/,
  /^\/api\/inventory\/revalue/,
  /^\/api\/inventory-counts/
];

export function middleware(req) {
  const authDisabledVal = (process.env.AUTH_DISABLED || '').toLowerCase();
  const authDisabled = authDisabledVal === '1' || authDisabledVal === 'true';
  if (authDisabled) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const method = req.method;
  if (method === 'GET') return NextResponse.next();
  const needsAuth = protectedPatterns.some((regex) => regex.test(pathname));
  if (!needsAuth) return NextResponse.next();

  const adminToken = process.env.ADMIN_TOKEN;
  const publicToken = process.env.NEXT_PUBLIC_ADMIN_TOKEN;
  if (!adminToken) {
    // If only public token is configured, still enforce it
    if (!publicToken) return NextResponse.next();
  }

  const headerToken = req.headers.get('x-admin-token');
  const ok = (adminToken && headerToken === adminToken) || (publicToken && headerToken === publicToken);
  if (!ok) {
    return new NextResponse(
      JSON.stringify({ error: 'Unauthorized' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
