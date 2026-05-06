import { checkPerm, normalizeRole } from '@/lib/authz';

function readCookie(name) {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function readLocalStorageRole() {
  if (typeof localStorage === 'undefined') return null;

  const directRole = localStorage.getItem('user-role');
  if (directRole) return directRole;

  const rawUser = localStorage.getItem('user');
  if (!rawUser) return null;

  try {
    const user = JSON.parse(rawUser);
    return user?.role || null;
  } catch {
    return null;
  }
}

export function getClientRole() {
  const devMode = (process.env.NEXT_PUBLIC_AUTH_DEV_MODE || process.env.AUTH_DEV_MODE) === '1';
  let role = readCookie('user-role') || readLocalStorageRole();
  if (devMode) {
    if (!role) role = process.env.NEXT_PUBLIC_DEFAULT_ROLE || process.env.DEFAULT_ROLE;
  } else {
    role = role || process.env.NEXT_PUBLIC_DEFAULT_ROLE || process.env.DEFAULT_ROLE;
  }
  return normalizeRole(role || 'VIEWER');
}

export function can(action, role) {
  return checkPerm(action, role || getClientRole());
}
