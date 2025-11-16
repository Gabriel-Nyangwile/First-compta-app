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
  const { pathname } = req.nextUrl;
  const method = req.method;
  if (method === 'GET') return NextResponse.next();
  const needsAuth = protectedPatterns.some((regex) => regex.test(pathname));
  if (!needsAuth) return NextResponse.next();

  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    return NextResponse.next();
  }

  const headerToken = req.headers.get('x-admin-token');
  if (headerToken !== adminToken) {
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
