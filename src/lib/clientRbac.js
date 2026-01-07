import { checkPerm, normalizeRole } from '@/lib/authz';

function readCookie(name) {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function getClientRole() {
  const devMode = (process.env.NEXT_PUBLIC_AUTH_DEV_MODE || process.env.AUTH_DEV_MODE) === '1';
  let role = null;
  if (devMode) {
    role = readCookie('user-role') || (typeof localStorage !== 'undefined' ? localStorage.getItem('user-role') : null);
    if (!role) role = process.env.NEXT_PUBLIC_DEFAULT_ROLE || process.env.DEFAULT_ROLE;
  } else {
    // Prod : utiliser la session réelle (à brancher). Fallback lecture éventuelle si fournie.
    role = process.env.NEXT_PUBLIC_DEFAULT_ROLE || process.env.DEFAULT_ROLE;
  }
  return normalizeRole(role || 'VIEWER');
}

export function can(action, role) {
  return checkPerm(action, role || getClientRole());
}
