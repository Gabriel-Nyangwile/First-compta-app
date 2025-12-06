import { absoluteUrl } from '@/lib/url';
import Link from 'next/link';
import { Suspense } from 'react';
import CreateForm from './createForm';

async function fetchSuppliers() {
  try {
    const url = await absoluteUrl('/api/suppliers');
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.suppliers)) return data.suppliers;
    }
  } catch {}
  return [];
}

async function fetchCategories() {
  try {
    const url = await absoluteUrl('/api/asset-categories');
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.categories)) return data.categories;
    }
  } catch {}
  return [];
}

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [suppliers, categories] = await Promise.all([fetchSuppliers(), fetchCategories()]);
  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <Link href="/asset-purchase-orders" className="text-sm text-blue-600 underline hover:text-blue-800 transition-colors">
          ← Retour BC immobilisations
        </Link>
      </div>
      <h1 className="text-xl font-semibold">Créer un BC Immobilisation</h1>
      <Suspense>
        <CreateForm suppliers={suppliers} categories={categories} />
      </Suspense>
    </div>
  );
}
