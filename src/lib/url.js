import { headers } from 'next/headers';

/**
 * Build an absolute URL for internal API calls in server components / routes.
 * Complies with Next 15+ dynamic API rules by awaiting headers().
 */
export async function absoluteUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || process.env.VERCEL_URL || 'localhost:3000';
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}${path}`;
}
