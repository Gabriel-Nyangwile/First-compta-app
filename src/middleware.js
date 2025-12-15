import { NextResponse } from 'next/server';
import { checkPerm, getUserRole } from '@/lib/authz';

const protectedPatterns = [
  /^\/api\/products$/,
  /^\/api\/purchase-orders/,
  /^\/api\/goods-receipts/,
  /^\/api\/stock-adjustments/,
  /^\/api\/inventory\/revalue/,
  /^\/api\/inventory-counts/,
];

const routePerms = [
  // Immobilisations (BC immo, assets, dotations)
  { pattern: /^\/api\/asset-purchase-orders\/[^/]+\/invoice/, action: 'generateAssetInvoice' },
  { pattern: /^\/api\/asset-purchase-orders\/[^/]+\/status/, action: 'approveAssetPO' },
  { pattern: /^\/api\/asset-purchase-orders/, action: 'createAssetPO' },
  { pattern: /^\/api\/assets\/depreciations\/post/, action: 'postDepreciation' },
  { pattern: /^\/api\/assets\/depreciations\/lock/, action: 'lockDepreciation' },
  { pattern: /^\/api\/assets\/[^/]+\/depreciation/, action: 'postDepreciation' },
  { pattern: /^\/api\/assets/, action: 'createAsset' },
  { pattern: /^\/api\/asset-categories/, action: 'createAsset' },

  // Achats
  { pattern: /^\/api\/purchase-orders\/[^/]+\/approve/, action: 'approvePurchaseOrder' },
  { pattern: /^\/api\/purchase-orders\/[^/]+\/cancel/, action: 'approvePurchaseOrder' },
  { pattern: /^\/api\/purchase-orders\/[^/]+\/close/, action: 'approvePurchaseOrder' },
  { pattern: /^\/api\/purchase-orders/, action: 'createPurchaseOrder' },
  { pattern: /^\/api\/goods-receipts/, action: 'receivePurchaseOrder' },
  { pattern: /^\/api\/incoming-invoices/, action: 'createIncomingInvoice' },

  // Ventes
  { pattern: /^\/api\/sales-orders\/[^/]+\/approve/, action: 'approveSalesOrder' },
  { pattern: /^\/api\/sales-orders/, action: 'createSalesOrder' },
  { pattern: /^\/api\/invoices/, action: 'createSalesInvoice' },

  // Trésorerie
  { pattern: /^\/api\/payments/, action: 'createPayment' },
  { pattern: /^\/api\/treasury/, action: 'createPayment' },

  // Comptabilité / journal
  { pattern: /^\/api\/transactions/, action: 'postJournalEntry' },
  { pattern: /^\/api\/journal-entries/, action: 'postJournalEntry' },

  // Stock & produits
  { pattern: /^\/api\/stock-adjustments/, action: 'manageInventory' },
  { pattern: /^\/api\/stock-movements/, action: 'manageInventory' },
  { pattern: /^\/api\/stock-withdrawals/, action: 'manageInventory' },
  { pattern: /^\/api\/inventory-counts/, action: 'manageInventory' },
  { pattern: /^\/api\/inventory\/revalue/, action: 'manageInventory' },
  { pattern: /^\/api\/products/, action: 'manageProducts' },

  // RH / Paie
  { pattern: /^\/api\/employee/, action: 'manageEmployees' },
  { pattern: /^\/api\/employee-history/, action: 'manageEmployees' },
  { pattern: /^\/api\/personnel/, action: 'manageEmployees' },
  { pattern: /^\/api\/contract/, action: 'manageEmployees' },
  { pattern: /^\/api\/position/, action: 'manageEmployees' },
  { pattern: /^\/api\/payroll/, action: 'managePayroll' },

  // Admin users
  { pattern: /^\/api\/admin\/users/, action: 'manageUsers' },
];

function isMethodGuarded(method) {
  const upper = method.toUpperCase();
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(upper);
}

function matchAction(pathname, method) {
  if (!isMethodGuarded(method)) return null;
  for (const rule of routePerms) {
    if (rule.pattern.test(pathname)) return rule.action;
  }
  return null;
}

function hasAdminToken(req) {
  const adminToken = process.env.ADMIN_TOKEN;
  const publicToken = process.env.NEXT_PUBLIC_ADMIN_TOKEN;
  if (!adminToken && !publicToken) return false;
  const headerToken = req.headers.get('x-admin-token');
  return (
    (adminToken && headerToken === adminToken) ||
    (publicToken && headerToken === publicToken)
  );
}

function legacyNeedsToken(pathname, method) {
  if (!isMethodGuarded(method)) return false;
  const adminToken = process.env.ADMIN_TOKEN;
  const publicToken = process.env.NEXT_PUBLIC_ADMIN_TOKEN;
  if (!adminToken && !publicToken) return false;
  return protectedPatterns.some((regex) => regex.test(pathname));
}

export async function middleware(req) {
  const authDisabledVal = (process.env.AUTH_DISABLED || '').toLowerCase();
  const authDisabled = authDisabledVal === '1' || authDisabledVal === 'true';
  if (authDisabled) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const method = req.method;

  const action = matchAction(pathname, method);
  // Bypass with admin token if provided
  if (hasAdminToken(req)) return NextResponse.next();

  if (action) {
    const role = await getUserRole(req);
    if (!checkPerm(action, role)) {
      return new NextResponse(
        JSON.stringify({ error: 'Accès refusé : rôle insuffisant', action }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return NextResponse.next();
  }

  // Legacy token guard for a few mutation endpoints (kept for compat)
  if (legacyNeedsToken(pathname, method)) {
    return new NextResponse(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
