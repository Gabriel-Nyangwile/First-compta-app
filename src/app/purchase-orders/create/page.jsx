import { absoluteUrl } from '@/lib/url';
import Link from 'next/link';
import Script from 'next/script';
import AuthorizedFetchBridge from '@/components/AuthorizedFetchBridge';

const CLIENT_ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'GLN-2709';

export const dynamic = 'force-dynamic';

async function fetchSuppliers() {
  try {
    const url = await absoluteUrl('/api/suppliers');
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data; // legacy simple array
      if (data && Array.isArray(data.suppliers)) return data.suppliers;
      return [];
    }
  } catch {}
  return [];
}

async function fetchProducts() {
  try {
    const url = await absoluteUrl('/api/products');
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.products)) return data.products; // fallback if future shape changes
      return [];
    }
  } catch {}
  return [];
}

export default async function CreatePurchaseOrderPage() {
  const [suppliers, products] = await Promise.all([fetchSuppliers(), fetchProducts()]);
  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <AuthorizedFetchBridge />
      <div className="flex items-center justify-between">
        <Link href="/purchase-orders" className="text-sm text-blue-600 underline hover:text-blue-800 transition-colors">
          &larr; Retour aux bons de commande
        </Link>
        <Link href="/sales-orders" className="text-sm text-blue-600 underline hover:text-blue-800 transition-colors">
          Voir commandes clients
        </Link>
      </div>
      <h1 className="text-xl font-semibold">Créer un bon de commande</h1>
      <POForm suppliers={suppliers} products={products} />
      <ProductModal />
      <div><Link href="/purchase-orders" className="text-sm text-blue-600 underline">← Retour liste</Link></div>
    </div>
  );
}

function LineRow({ index, products }) {
  return (
    <div className="grid grid-cols-6 gap-2 items-start" data-line-row>
      <div className="space-y-1 col-span-2">
        <select name={`lines[${index}][productId]`} className="border px-2 py-1 rounded text-xs w-full" data-product-select>
          <option value="">Produit…</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="text" placeholder="Rechercher…" className="border px-2 py-1 rounded text-[10px] w-full" data-product-search />
      </div>
      <input name={`lines[${index}][orderedQty]`} type="number" step="0.001" placeholder="Qté" className="border px-2 py-1 rounded text-xs" data-qty />
      <input name={`lines[${index}][unitPrice]`} type="number" step="0.0001" placeholder="PU" className="border px-2 py-1 rounded text-xs" data-unit-price />
      <input name={`lines[${index}][vatRate]`} type="number" step="0.01" placeholder="TVA" className="border px-2 py-1 rounded text-xs" />
      <button type="button" data-remove className="text-xs text-red-600 mt-1">Supprimer</button>
    </div>
  );
}

function POForm({ suppliers, products }) {
  return (
    <form className="space-y-6" data-po-form noValidate>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="text-xs space-y-1 block">
            <span className="font-medium">Fournisseur</span>
            <select name="supplierId" className="border px-2 py-1 rounded text-sm w-full" required>
              <option value="">Choisir…</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="text-xs space-y-1 block">
            <span className="font-medium">Date attendue</span>
            <input type="date" name="expectedDate" className="border px-2 py-1 rounded text-sm w-full" />
          </label>
          <label className="text-xs space-y-1 block">
            <span className="font-medium">Devise</span>
            <input type="text" name="currency" defaultValue="EUR" className="border px-2 py-1 rounded text-sm w-full" />
          </label>
        </div>
        <div className="md:col-span-2 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wide uppercase text-gray-600">Lignes</h2>
            <div className="flex gap-2 flex-wrap">
              <button type="button" data-add-line className="px-2 py-1 text-xs bg-blue-600 text-white rounded">+ Ligne</button>
              <button type="button" data-open-product-modal className="px-2 py-1 text-xs bg-indigo-600 text-white rounded">+ Produit</button>
              <button type="button" data-refresh-products className="px-2 py-1 text-xs bg-slate-500 text-white rounded">Rafraîchir</button>
            </div>
          </div>
          <div className="space-y-3" data-lines-container>
            <LineRow index={0} products={products} />
          </div>
          <div className="text-[10px] text-gray-500">Remplir au moins une ligne (quantité & prix requis). Une ligne vide à la fin sera ajoutée automatiquement.</div>
        </div>
      </div>
      <label className="text-xs space-y-1 block">
        <span className="font-medium">Notes</span>
        <textarea name="notes" rows={3} className="border px-2 py-1 rounded text-sm w-full" placeholder="Instructions, commentaires..."></textarea>
      </label>
      <div className="flex gap-2 pt-2">
        <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded text-sm">Créer</button>
        <a href="/purchase-orders" className="px-4 py-2 bg-gray-300 rounded text-sm">Annuler</a>
      </div>
      <div id="toast-container" className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none" />
      <ClientEnhancements />
    </form>
  );
}

// (Ancienne server action supprimée : soumission gérée côté client pour feedback fiable.)

// Client-side enhancements component (islands approach)
function ClientEnhancements() {
  return (
    <Script id="po-form-enhancements" strategy="afterInteractive">{`
      (function(){
        try {
        const ADMIN_TOKEN = ${JSON.stringify(CLIENT_ADMIN_TOKEN)};
        const fallbackAuthorizedFetch = (input, init = {}) => {
          const baseHeaders = (init && init.headers) ? init.headers : {};
          const headers = Object.assign({}, baseHeaders, { "x-admin-token": ADMIN_TOKEN });
          return fetch(input, Object.assign({}, init || {}, { headers }));
        };
        const protectedFetch = (input, init = {}) => {
          const fn = window.authorizedFetch;
          if (typeof fn === 'function') {
            return fn(input, init);
          }
          return fallbackAuthorizedFetch(input, init);
        };
        const form = document.querySelector('[data-po-form]');
        if(!form) return;
        const container = form.querySelector('[data-lines-container]');
        const addBtn = form.querySelector('[data-add-line]');
        const openProductBtn = form.querySelector('[data-open-product-modal]');
  const refreshBtn = form.querySelector('[data-refresh-products]');
        let didInitialFullProductFetch = false;
        async function refreshAllProductSelects(forceFocusSelect){
          try {
            const res = await fetch('/api/products?ts=' + Date.now(), { cache: 'no-store' });
            if(!res.ok) return;
            let all = await res.json();
            if(!Array.isArray(all)) { all = Array.isArray(all?.products) ? all.products : []; }
            const selects = form.querySelectorAll('select[name$="[productId]"]');
            selects.forEach(sel=>{
              const current = sel.value;
              sel.querySelectorAll('option:not(:first-child)').forEach(o=>o.remove());
              all.forEach(p=>{ const o=document.createElement('option'); o.value=p.id; o.textContent=p.name; sel.appendChild(o); });
              if(current && [...sel.options].some(o=>o.value===current)) sel.value=current; else if(forceFocusSelect && sel===forceFocusSelect) sel.selectedIndex=0;
            });
            updateUsedProducts();
          } catch {}
        }
  refreshBtn?.addEventListener('click', ()=>{ didInitialFullProductFetch = true; refreshAllProductSelects(); showToast('Liste produits rafraîchie','info'); });
        // One-time auto refresh on first focus of any select to capture products created in autre onglet depuis chargement
        container.addEventListener('focusin', (e)=>{
          const sel = e.target.closest('select[name$="[productId]"]');
          if(sel && !didInitialFullProductFetch){ didInitialFullProductFetch = true; refreshAllProductSelects(sel); }
        });
  // Track the currently active line index when opening the product modal
  let activeLineIndexForNewProduct = null;
        const modal = () => document.getElementById('product-modal');
        const closeBtn = () => document.getElementById('product-modal-close');
        const toastRoot = document.getElementById('toast-container');
        function showToast(msg, type='info'){ if(!toastRoot) return; const div=document.createElement('div'); div.className='pointer-events-auto text-xs px-3 py-2 rounded shadow text-white fade-in'; const colors={info:'bg-slate-700',success:'bg-emerald-600',error:'bg-red-600',warn:'bg-amber-600'}; div.classList.add(colors[type]||colors.info); div.textContent=msg; toastRoot.appendChild(div); setTimeout(()=>{div.classList.add('opacity-0'); setTimeout(()=>div.remove(),300);}, 4000);}        
        // Debounce helper
        function debounce(fn,ms){let t;return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}
        function reindex(){
          [...container.children].forEach((row,i)=>{
            row.querySelectorAll('select, input').forEach(el=>{
              const name = el.getAttribute('name');
              if(name){
                const nn = name.replace(/lines\[(\d+)\]/,'lines['+i+']');
                el.setAttribute('name', nn);
              }
            });
          });
        }
        function updateUsedProducts(){
          const selects = [...form.querySelectorAll('select[name$="[productId]"]')];
          const used = selects.map(s=>s.value).filter(Boolean);
          selects.forEach(sel=>{
            const current = sel.value;
            [...sel.options].forEach(opt=>{
              if(!opt.value) return; // skip placeholder
              // Remove previous marker
              opt.textContent = opt.textContent.replace(/ \(déjà utilisé\)$/,'');
              if(opt.value !== current && used.includes(opt.value)){
                // Annotate but keep enabled so full catalogue visible
                opt.textContent = opt.textContent + ' (déjà utilisé)';
                opt.disabled = false;
              } else {
                opt.disabled = false;
              }
            });
          });
        }
        function addLine(opts={ focus:true }){
            let template = container.children[0];
            if(!template){
              // Fallback: créer un bloc minimal si jamais plus de ligne présente
              const div = document.createElement('div');
              div.className='grid grid-cols-6 gap-2 items-start';
              div.setAttribute('data-line-row','');
              div.innerHTML = '<div class="space-y-1 col-span-2">'
                + '<select name="lines[0][productId]" class="border px-2 py-1 rounded text-xs w-full" data-product-select>'
                + '<option value="">Produit…</option>'
                + '</select>'
                + '<input type="text" placeholder="Rechercher…" class="border px-2 py-1 rounded text-[10px] w-full" data-product-search />'
                + '</div>'
                + '<input name="lines[0][orderedQty]" type="number" step="0.001" placeholder="Qté" class="border px-2 py-1 rounded text-xs" data-qty />'
                + '<input name="lines[0][unitPrice]" type="number" step="0.0001" placeholder="PU" class="border px-2 py-1 rounded text-xs" data-unit-price />'
                + '<input name="lines[0][vatRate]" type="number" step="0.01" placeholder="TVA" class="border px-2 py-1 rounded text-xs" />'
                + '<button type="button" data-remove class="text-xs text-red-600 mt-1">Supprimer</button>';
              container.appendChild(div);
              template = div;
            }
            const clone = template.cloneNode(true);
              // Nettoyage valeurs
              clone.querySelectorAll('input').forEach(inp=>{inp.value='';});
              const sel = clone.querySelector('select[name$="[productId]"]'); if(sel) sel.selectedIndex = 0;
              container.appendChild(clone);
              reindex();
              attachProductSearch(clone);
              updateUsedProducts();
              if(opts.focus){ setTimeout(()=>{ sel && sel.focus(); }, 30); }
              console.debug('[PO] Ligne ajoutée. Total lignes =', container.children.length);
        }
        function maybeAddNewLine(){
            // Ajout auto seulement si toutes les lignes actuelles (non vides) ont un produit sélectionné
            const rows = [...container.querySelectorAll('[data-line-row]')];
            if(!rows.length) return;
            const selects = rows.map(r=> r.querySelector('select[name$="[productId]"]')).filter(Boolean);
            if(!selects.length) return;
            const allHave = selects.every(s=> s.value);
            if(allHave){
              addLine({ focus:false });
            }
        }
        // Handlers boutons (éviter toute soumission implicite)
        addBtn?.addEventListener('click', (e)=>{ e.preventDefault(); addLine({ focus:true }); });
        refreshBtn?.addEventListener('click', (e)=>{ e.preventDefault(); refreshAllProductSelects(); showToast('Liste produits rafraîchie','info'); });
        // (Le bouton nouveau produit a son listener plus bas pour gérer l'index actif)
        container.addEventListener('click', (e)=>{
          const btn = e.target.closest('[data-remove]');
          if(btn){
            const row = btn.closest('.grid');
            if(container.children.length>1){
              row.remove();
              reindex();
              updateUsedProducts();
            } else {
              row.querySelectorAll('input').forEach(i=>i.value='');
            }
          }
        });
        // Track previous value for duplicate revert
        container.addEventListener('focusin', (e)=>{
          const sel = e.target.closest('select[name$="[productId]"]');
          if(sel){ sel.dataset.prev = sel.value; }
        });
        container.addEventListener('change', (e)=>{
          const sel = e.target.closest('select[name$="[productId]"]');
          if(!sel) return;
          const val = sel.value;
          if(val){
            const others = [...form.querySelectorAll('select[name$="[productId]"]')].filter(s=>s!==sel);
            if(others.some(o=>o.value === val)){
              showToast('Produit déjà utilisé','error');
              sel.value = sel.dataset.prev || '';
              return;
            }
          }
          updateUsedProducts();
          if(val) maybeAddNewLine();
        });
        // Product modal logic
        openProductBtn?.addEventListener('click', ()=>{
          // Determine active line (focused element inside a row) else last row
          const focused = document.activeElement;
          let row = focused && focused.closest('[data-line-row]');
            if(!row) row = container.lastElementChild;
          activeLineIndexForNewProduct = row ? [...container.children].indexOf(row) : null;
          const m = modal(); if(m){ m.style.display='block'; setTimeout(()=>{
            // Focus first input in modal for fast entry
            const sku = m.querySelector('input[name="sku"]'); sku && sku.focus();
          },10); }
        });
        closeBtn()?.addEventListener('click', ()=>{ const m = modal(); if(m){ m.style.display='none'; }});
        document.addEventListener('click', (e)=>{
          const m = modal(); if(!m) return; if(e.target === m) { m.style.display='none'; }
        });
        document.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ const m=modal(); if(m) m.style.display='none'; }});
  const productForm = document.getElementById('new-product-form');
  const closeBtn2 = document.getElementById('product-modal-close-2');
  closeBtn2?.addEventListener('click', ()=>{ const m=modal(); if(m) m.style.display='none'; });
        productForm?.addEventListener('submit', async (e)=>{
          e.preventDefault();
          const fd = new FormData(productForm);
          const payload = {
            sku: fd.get('sku'),
            name: fd.get('name'),
            description: fd.get('description') || undefined,
            unit: fd.get('unit') || undefined
          };
          const btn = productForm.querySelector('button[type="submit"]');
          btn.disabled = true; btn.textContent='Création…';
          try {
            const res = await protectedFetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if(!res.ok){
              showToast(data.error || 'Erreur création produit','error');
            } else {
              // Refetch full fresh product list (cache buster) to ensure consistency
              try {
                const allRes = await fetch('/api/products?ts=' + Date.now(), { cache: 'no-store' });
                if(allRes.ok){
                  const all = await allRes.json();
                  const selects = form.querySelectorAll('select[name$="[productId]"]');
                  selects.forEach(sel => {
                    const current = sel.value;
                    // Keep placeholder (first option)
                    sel.querySelectorAll('option:not(:first-child)').forEach(o=>o.remove());
                    all.forEach(p=>{ const o=document.createElement('option'); o.value=p.id; o.textContent=p.name; sel.appendChild(o); });
                    if(current && [...sel.options].some(o=>o.value===current)) sel.value=current;
                  });
                  // Select newly created product in the previously active row (fallback last)
                  let targetRow = (activeLineIndexForNewProduct != null) ? container.children[activeLineIndexForNewProduct] : container.lastElementChild;
                  if(!targetRow) targetRow = container.lastElementChild;
                  const selTarget = targetRow?.querySelector('select[name$="[productId]"]');
                  if(selTarget) selTarget.value = data.id;
                  // Focus quantity field for quick continuation
                  const qty = targetRow?.querySelector('[data-qty]'); qty && qty.focus();
                  updateUsedProducts();
                  maybeAddNewLine();
                  activeLineIndexForNewProduct = null;
                }
              } catch {}
              productForm.reset();
              const m = modal(); if(m){ m.style.display='none'; }
              showToast('Produit créé','success');
            }
          } catch(err){
            showToast('Erreur réseau','error');
          } finally {
            btn.disabled = false; btn.textContent='Créer';
          }
        });

        // Autocomplete product search per row
        function attachProductSearch(row){
          const input = row.querySelector('[data-product-search]');
            const select = row.querySelector('[data-product-select]');
            if(!input || !select) return;
            const run = debounce(async ()=>{
              const q = input.value.trim();
              if(q.length < 2){ return; }
              try {
                const res = await fetch('/api/products?q='+encodeURIComponent(q)+'&ts=' + Date.now(), { cache: 'no-store' });
                if(!res.ok) return;
                const list = await res.json();
                const current = select.value;
                // Keep first empty option
                select.querySelectorAll('option:not(:first-child)').forEach(o=>o.remove());
                list.forEach(p=>{ const o=document.createElement('option'); o.value=p.id; o.textContent=p.name; select.appendChild(o); });
                // Try to restore current selection if still present
                if(current && [...select.options].some(o=>o.value===current)) select.value=current;
                updateUsedProducts();
              } catch {}
            }, 300);
            input.addEventListener('input', run);
        }
        [...container.children].forEach(attachProductSearch);
        updateUsedProducts();

        // Client-side validation before submit
        form.addEventListener('submit', async (e)=>{
          e.preventDefault();
          const submitBtn = form.querySelector('button[type="submit"]');
          if(submitBtn) { submitBtn.disabled = true; submitBtn.dataset.originalText = submitBtn.textContent; submitBtn.textContent='Création…'; }
          try {
            const supplier = form.querySelector('select[name="supplierId"]').value;
            if(!supplier){ showToast('Fournisseur requis','error'); return; }
            const rows = [...container.querySelectorAll('[data-line-row]')];
            const parseNum = (v)=>{ return parseFloat(String(v).replace(',', '.')); };
            rows.forEach(r=> r.classList.remove('ring-2','ring-red-500'));
            const lines = [];
            for(const r of rows){
              const pid = r.querySelector('[data-product-select]').value;
              const qtyEl = r.querySelector('[data-qty]');
              const upEl = r.querySelector('[data-unit-price]');
              const vatEl = r.querySelector('[name$="[vatRate]"]');
              const qtyRaw = qtyEl.value.trim();
              const upRaw = upEl.value.trim();
              const vatRaw = vatEl?.value?.trim() || '';
              const empty = !pid && !qtyRaw && !upRaw && !vatRaw;
              if(empty) continue;
              if(!pid){ showToast('Produit manquant','error'); r.classList.add('ring-2','ring-red-500'); return; }
              const qty = parseNum(qtyRaw);
              const up = parseNum(upRaw);
              if(!(qty>0)){ showToast('Quantité > 0 requise','error'); r.classList.add('ring-2','ring-red-500'); return; }
              if(isNaN(up) || up < 0){ showToast('PU >= 0 requis','error'); r.classList.add('ring-2','ring-red-500'); return; }
              let vatRate; if(vatRaw){ const v=parseNum(vatRaw); if(isNaN(v) || v<0){ showToast('TVA invalide','error'); r.classList.add('ring-2','ring-red-500'); return; } vatRate=v; }
              lines.push({ productId: pid, orderedQty: qty.toString(), unitPrice: up.toString(), vatRate: vatRate!=null ? vatRate.toFixed(2): undefined });
            }
            if(!lines.length){ showToast('Ajouter au moins une ligne valide','error'); return; }
            const payload = {
              supplierId: supplier,
              expectedDate: form.querySelector('input[name="expectedDate"]').value || undefined,
              currency: form.querySelector('input[name="currency"]').value || 'EUR',
              notes: form.querySelector('textarea[name="notes"]').value || undefined,
              lines
            };
            // Debug console pour diagnostic
            console.debug('[PO SUBMIT] Payload', payload);
            const resp = await protectedFetch('/api/purchase-orders', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
            if(!resp.ok){
              let msg = 'Erreur création PO';
              try { const d = await resp.json(); if(d?.error) msg = d.error; } catch {}
              showToast(msg,'error');
              return;
            }
            const created = await resp.json();
            if(created?.id){
              showToast('Bon de commande créé','success');
              window.location.href = '/purchase-orders/' + created.id;
            } else {
              showToast('Réponse inattendue serveur','error');
            }
          } finally {
            if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = submitBtn.dataset.originalText || 'Créer'; }
          }
        });
        } catch(err){
          console.error('[PO] Init error', err);
        }
      })();
    `}</Script>
  );
}

function ProductModal(){
  return (
    <div id="product-modal" style={{display:'none'}} className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 p-6 overflow-auto">
      <div className="bg-white rounded shadow-lg w-full max-w-md p-4 space-y-4 relative">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Nouveau produit</h3>
          <button type="button" id="product-modal-close" className="text-xs text-gray-500 hover:text-black">✕</button>
        </div>
  {/* Form in a Server Component must not include inline event handlers; JS enhancement script attaches its own submit listener */}
  <form id="new-product-form" className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] space-y-1 col-span-1">
              <span className="font-medium">SKU *</span>
              <input name="sku" required className="border px-2 py-1 rounded text-xs w-full" />
            </label>
            <label className="text-[11px] space-y-1 col-span-1">
              <span className="font-medium">Nom *</span>
              <input name="name" required className="border px-2 py-1 rounded text-xs w-full" />
            </label>
          </div>
          <label className="text-[11px] space-y-1 block">
            <span className="font-medium">Description</span>
            <textarea name="description" rows={2} className="border px-2 py-1 rounded text-xs w-full" />
          </label>
            <label className="text-[11px] space-y-1 block">
              <span className="font-medium">Unité</span>
              <input name="unit" placeholder="PCS" className="border px-2 py-1 rounded text-xs w-full" />
            </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" id="product-modal-close-2" className="px-3 py-1 text-xs bg-gray-200 rounded">Annuler</button>
            <button type="submit" className="px-4 py-1 text-xs bg-emerald-600 text-white rounded">Créer</button>
          </div>
          <p className="text-[10px] text-gray-500">Les champs marqués * sont obligatoires.</p>
        </form>
      </div>
    </div>
  );
}