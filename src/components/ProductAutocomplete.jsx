import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export default function ProductAutocomplete({ value, onChange, products }) {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const labelFromProduct = useMemo(
    () => (product) =>
      product ? `${product.sku} - ${product.name}` : "",
    []
  );

  useEffect(() => {
    if (value) {
      setQuery(labelFromProduct(value));
    } else if (!showDropdown) {
      setQuery("");
    }
  }, [value, labelFromProduct, showDropdown]);

  const filtered = query
    ? (products || []).filter((p) => {
        const candidate = query.toLowerCase();
        return (
          p.name.toLowerCase().includes(candidate) ||
          p.sku.toLowerCase().includes(candidate)
        );
      })
    : products || [];

  function handleSelect(product) {
    onChange(product);
    setQuery(labelFromProduct(product));
    setShowDropdown(false);
  }

  function handleInput(e) {
    const nextQuery = e.target.value;
    setQuery(nextQuery);
    setShowDropdown(true);
    if (value && labelFromProduct(value) !== nextQuery) {
      onChange(null);
    }
  }

  function formatStock(rawQty) {
    const qty = Number(rawQty ?? 0);
    if (!Number.isFinite(qty)) return "0";
    return qty.toFixed(3);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => setShowDropdown(true)}
        placeholder="Rechercher ou créer..."
        className="block w-full border rounded px-2 py-1"
      />
      {showDropdown && (
        <div className="absolute left-0 right-0 bg-white border rounded shadow z-10 max-h-56 overflow-auto">
          {filtered.length > 0 ? (
            filtered.map((product) => (
              <button
                key={product.id}
                type="button"
                className="block w-full text-left px-4 py-2 hover:bg-blue-50"
                onClick={() => handleSelect(product)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col text-left">
                    <span className="font-mono text-xs text-slate-700">
                      {product.sku}
                    </span>
                    <span className="text-sm text-slate-900">
                      {product.name}
                    </span>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 text-[11px] rounded-full bg-slate-100 text-slate-700">
                    Stock {formatStock(product.qtyOnHand)}
                  </span>
                </div>
              </button>
            ))
          ) : (
            <div className="p-2 text-gray-500">Aucun produit trouvé.</div>
          )}
          <div className="border-t mt-1">
            <Link
              href="/products/create"
              className="block px-4 py-2 text-blue-600 hover:bg-blue-50"
            >
              + Créer un nouveau produit
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
