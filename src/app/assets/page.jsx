import BackButtonLayoutHeader from '@/components/BackButtonLayoutHeader';
import AssetTables from './AssetTables';
import { internalApiFetch } from '@/lib/url';

export const dynamic = 'force-dynamic';

async function fetchAll() {
  try {
    const [catsRes, assetsRes] = await Promise.all([
      internalApiFetch('/api/asset-categories', { cache: 'no-store' }),
      internalApiFetch('/api/assets', { cache: 'no-store' }),
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
