import BackButtonLayoutHeader from '@/components/BackButtonLayoutHeader';
import AssetTables from './AssetTables';

export const dynamic = 'force-dynamic';

async function fetchAll() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  try {
    const [catsRes, assetsRes] = await Promise.all([
      fetch(`${base}/api/asset-categories`, { cache: 'no-store' }),
      fetch(`${base}/api/assets`, { cache: 'no-store' }),
    ]);
    if (!catsRes.ok || !assetsRes.ok) {
      return { error: 'Échec chargement immobilisations', categories: [], assets: [] };
    }
    const cats = await catsRes.json();
    const assets = await assetsRes.json();
    return { error: null, categories: cats.categories || [], assets: assets.assets || [] };
  } catch (e) {
    return { error: e.message || 'Erreur réseau', categories: [], assets: [] };
  }
}

export default async function AssetsPage() {
  const { categories, assets, error } = await fetchAll();
  return (
    <div className="p-6 space-y-6">
      <BackButtonLayoutHeader />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Immobilisations</h1>
          <p className="text-sm text-gray-600">Catégories, actifs, dotations et cessions.</p>
        </div>
        {error && <span className="text-sm text-red-600">⚠ {error}</span>}
      </div>
      <AssetTables initialCategories={categories} initialAssets={assets} />
    </div>
  );
}
