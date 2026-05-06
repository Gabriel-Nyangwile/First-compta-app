import { internalApiFetch } from '@/lib/url';
import ProductsClient from '@/components/products/ProductsClient';

async function fetchProducts(searchParams) {
  try {
    const qs = new URLSearchParams();
    if (searchParams?.stockNature) qs.set('stockNature', searchParams.stockNature);
    const res = await internalApiFetch(`/api/products${qs.toString() ? `?${qs}` : ''}`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

async function fetchInventory(productId) {
  try {
    const res = await internalApiFetch(`/api/inventory/${productId}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export const dynamic = 'force-dynamic';

export default async function ProductsPage(props) {
  const searchParams = await props.searchParams;
  const products = await fetchProducts(searchParams);
  const inventories = await Promise.all(products.map(p => fetchInventory(p.id)));
  const enriched = products.map((p,i) => ({
    ...p,
    qtyOnHand: inventories[i]?.inventory?.qtyOnHand || '0',
    avgCost: inventories[i]?.inventory?.avgCost
  }));
  return <ProductsClient initialProducts={enriched} />;
}
