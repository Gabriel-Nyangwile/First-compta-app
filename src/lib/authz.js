// RBAC helper. Récupère le rôle depuis un header / cookie ou une valeur par défaut.
// Branchez ici votre session NextAuth/JWT si disponible.

const roleAliases = {
  ADMIN: 'SUPERADMIN',
  SUPERADMIN: 'SUPERADMIN',
  FINANCE: 'FINANCE_MANAGER',
  FINANCE_MANAGER: 'FINANCE_MANAGER',
  ACCOUNTANT: 'ACCOUNTANT',
  ACCOUNTING: 'ACCOUNTANT',
  PROCUREMENT: 'PROCUREMENT',
  PURCHASING: 'PROCUREMENT',
  SALES: 'SALES',
  HR: 'HR_MANAGER',
  HRMANAGER: 'HR_MANAGER',
  HR_MANAGER: 'HR_MANAGER',
  PAYROLL: 'PAYROLL_CLERK',
  PAYROLLCLERK: 'PAYROLL_CLERK',
  PAYROLL_CLERK: 'PAYROLL_CLERK',
  TREASURY: 'TREASURY',
  TREASURER: 'TREASURY',
  VIEWER: 'VIEWER',
};

export const permMap = {
  // Immobilisations
  createAsset: ['SUPERADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'],
  approveAssetPO: ['SUPERADMIN', 'FINANCE_MANAGER'],
  receiveAssetPO: ['SUPERADMIN', 'FINANCE_MANAGER', 'PROCUREMENT'],
  generateAssetInvoice: ['SUPERADMIN', 'FINANCE_MANAGER'],
  postDepreciation: ['SUPERADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'],
  lockDepreciation: ['SUPERADMIN', 'FINANCE_MANAGER'],
  createAssetPO: ['SUPERADMIN', 'FINANCE_MANAGER', 'PROCUREMENT'],

  // Achats (BC/fournisseur)
  createPurchaseOrder: ['SUPERADMIN', 'FINANCE_MANAGER', 'PROCUREMENT'],
  approvePurchaseOrder: ['SUPERADMIN', 'FINANCE_MANAGER'],
  receivePurchaseOrder: ['SUPERADMIN', 'FINANCE_MANAGER', 'PROCUREMENT'],
  createIncomingInvoice: ['SUPERADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'PROCUREMENT'],
  approveIncomingInvoice: ['SUPERADMIN', 'FINANCE_MANAGER'],

  // Ventes (clients)
  createSalesOrder: ['SUPERADMIN', 'SALES', 'FINANCE_MANAGER'],
  approveSalesOrder: ['SUPERADMIN', 'FINANCE_MANAGER'],
  createSalesInvoice: ['SUPERADMIN', 'SALES', 'FINANCE_MANAGER'],
  approveSalesInvoice: ['SUPERADMIN', 'FINANCE_MANAGER'],

  // Trésorerie
  createPayment: ['SUPERADMIN', 'TREASURY', 'FINANCE_MANAGER'],
  approvePayment: ['SUPERADMIN', 'TREASURY', 'FINANCE_MANAGER'],
  createCollection: ['SUPERADMIN', 'TREASURY', 'FINANCE_MANAGER'],
  approveCollection: ['SUPERADMIN', 'TREASURY', 'FINANCE_MANAGER'],
  reconcile: ['SUPERADMIN', 'TREASURY', 'FINANCE_MANAGER', 'ACCOUNTANT'],
  createMoneyMovement: ['SUPERADMIN', 'TREASURY', 'FINANCE_MANAGER'],
  approveTreasury: ['SUPERADMIN', 'TREASURY', 'FINANCE_MANAGER'],

  // Paie & personnel
  manageEmployees: ['SUPERADMIN', 'HR_MANAGER'],
  managePayroll: ['SUPERADMIN', 'HR_MANAGER', 'PAYROLL_CLERK', 'FINANCE_MANAGER'],
  approvePayroll: ['SUPERADMIN', 'HR_MANAGER', 'FINANCE_MANAGER'],

  // Stock & produit
  manageInventory: ['SUPERADMIN', 'FINANCE_MANAGER', 'PROCUREMENT', 'ACCOUNTANT'],
  manageProducts: ['SUPERADMIN', 'FINANCE_MANAGER', 'PROCUREMENT', 'ACCOUNTANT'],

  // Comptabilité / Journal
  postJournalEntry: ['SUPERADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'],
  reopenPeriod: ['SUPERADMIN', 'FINANCE_MANAGER'],
  exportAccounting: ['SUPERADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'],

  // Admin
  manageUsers: ['SUPERADMIN'],
  manageRoles: ['SUPERADMIN'],
};

export function normalizeRole(role) {
  const raw = role?.toString?.().trim();
  if (!raw) return 'VIEWER';
  const upper = raw.toUpperCase().replace(/[\s-]+/g, '_');
  return roleAliases[upper] || upper;
}

export function checkPerm(action, role) {
  const normalized = normalizeRole(role);
  const allowed = permMap[action] || [];
  return !!normalized && allowed.includes(normalized);
}

export async function getUserRole(req) {
  // 1) header explicite
  const headerRole = req.headers.get('x-user-role');
  if (headerRole) return normalizeRole(headerRole);
  // 2) cookie (ex: set via document.cookie = "user-role=SUPERADMIN")
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|; )user-role=([^;]+)/);
  if (match) return normalizeRole(decodeURIComponent(match[1]));
  // 3) fallback env (utile en dev)
  return normalizeRole(process.env.DEFAULT_ROLE || 'VIEWER');
}
