import { absoluteUrl } from '@/lib/url';
import ProductsClient from '@/components/products/ProductsClient';

async function fetchProducts() {
  try {
    const url = await absoluteUrl('/api/products');
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

async function fetchInventory(productId) {
  try {
    const url = await absoluteUrl(`/api/inventory/${productId}`);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const products = await fetchProducts();
  const inventories = await Promise.all(products.map(p => fetchInventory(p.id)));
  const enriched = products.map((p,i) => ({
    ...p,
    qtyOnHand: inventories[i]?.inventory?.qtyOnHand || '0',
    avgCost: inventories[i]?.inventory?.avgCost
  }));
  return <ProductsClient initialProducts={enriched} />;
}
