"use client";
import Link from "next/link";
import { useEffect, useState, useRef, useCallback } from 'react';

function Badge({ count, color }) {
  if (count === null || count === 0) return null;
  const colorClasses = { red: 'bg-red-600', orange: 'bg-orange-600', gray: 'bg-gray-500' };
  return <span className={`ml-2 inline-block ${colorClasses[color] || colorClasses.gray} text-white text-[10px] px-2 py-0.5 rounded-full`}>{count}</span>;
}

function useInvoiceBadges(active) {
  const [salesUnpaid, setSalesUnpaid] = useState(null);
  const [purchaseUnpaid, setPurchaseUnpaid] = useState(null);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    async function loadCounts() {
      try {
        const [c1, c2] = await Promise.all([
          fetch('/api/invoices/unpaid-count').then(r=>r.ok?r.json():{count:0}),
          fetch('/api/incoming-invoices/unpaid-count').then(r=>r.ok?r.json():{count:0})
        ]);
        if (!cancelled) {
          setSalesUnpaid(c1.count ?? 0); setPurchaseUnpaid(c2.count ?? 0);
        }
      } catch { if (!cancelled) { setSalesUnpaid(0); setPurchaseUnpaid(0); } }
    }
    loadCounts();
    return () => { cancelled = true; };
  }, [active]);
  return { salesUnpaid, purchaseUnpaid };
}

function useClickOutside(ref, handler, enabled=true) {
  useEffect(() => {
    if (!enabled) return;
    function listener(e) { if (!ref.current || ref.current.contains(e.target)) return; handler(); }
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => { document.removeEventListener('mousedown', listener); document.removeEventListener('touchstart', listener); };
  }, [ref, handler, enabled]);
}

function useBlurClose(ref, open, close) {
  useEffect(() => {
    if (!open) return;
    function handleFocusOut() {
      requestAnimationFrame(() => {
        if (!ref.current) return;
        if (document.activeElement && ref.current.contains(document.activeElement)) return;
        close();
      });
    }
    document.addEventListener('focusout', handleFocusOut);
    return () => document.removeEventListener('focusout', handleFocusOut);
  }, [open, close, ref]);
}

function DashboardMenu({ onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(()=>setOpen(false),[]);
  useClickOutside(ref, close, open); useBlurClose(ref, open, close);
  useEffect(()=>{ function onKey(e){ if(e.key==='Escape') close(); } if(open) document.addEventListener('keydown', onKey); return ()=>document.removeEventListener('keydown', onKey); },[open, close]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(o=>!o)} className="px-3 py-2 text-sm font-medium text-white bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 flex items-center gap-1">
        <span>Dashboard</span><span className="text-[10px] opacity-70">{open?'▲':'▼'}</span>
      </button>
      {open && (
        <div role="menu" className="absolute left-0 mt-2 w-52 bg-blue-900 text-white rounded shadow-lg z-50 py-1 animate-fade-in">
          <Link href="/dashboard" className="block px-4 py-2 text-sm hover:bg-blue-800" onClick={close}>Accueil</Link>
          <Link href="/tiers" className="block px-4 py-2 text-sm hover:bg-blue-800" onClick={close}>Vue Tiers</Link>
          <button className="block w-full text-left px-4 py-2 text-sm text-red-300 hover:bg-blue-800 hover:text-red-200" onClick={() => { close(); onLogout(); }}>Se déconnecter</button>
        </div>
      )}
    </div>
  );
}

function AnalyseMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(()=>setOpen(false),[]);
  useClickOutside(ref, close, open); useBlurClose(ref, open, close);
  useEffect(()=>{ function onKey(e){ if(e.key==='Escape') close(); } if(open) document.addEventListener('keydown', onKey); return ()=>document.removeEventListener('keydown', onKey); },[open, close]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(o=>!o)} className="px-3 py-2 text-sm font-medium text-white bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 flex items-center gap-1">
        <span>Analyse</span><span className="text-[10px] opacity-70">{open?'▲':'▼'}</span>
      </button>
      {open && (
        <div role="menu" className="absolute left-0 mt-2 w-56 bg-blue-900 text-white rounded shadow-lg z-50 py-1 animate-fade-in">
          <Link href="/transactions" className="block px-4 py-2 text-sm hover:bg-blue-800" onClick={close}>Transactions</Link>
            <Link href="/vat-recap" className="block px-4 py-2 text-sm hover:bg-blue-800" onClick={close}>Récap TVA</Link>
          <Link href="/treasury" className="block px-4 py-2 text-sm hover:bg-blue-800" onClick={close}>Trésorerie</Link>
        </div>
      )}
    </div>
  );
}

function TreasuryOperationsMenu() {
  const [open, setOpen] = useState(false);
  const [openCash, setOpenCash] = useState(true);
  const [openBank, setOpenBank] = useState(true);
  const [openTransfers, setOpenTransfers] = useState(true);
  const ref = useRef(null);
  const close = useCallback(()=>setOpen(false),[]);
  useClickOutside(ref, close, open); useBlurClose(ref, open, close);
  useEffect(()=>{ function onKey(e){ if(e.key==='Escape') close(); } if(open) document.addEventListener('keydown', onKey); return ()=>document.removeEventListener('keydown', onKey); },[open, close]);
  const sectionBtn = "w-full flex items-center justify-between px-2 py-1 font-semibold text-white hover:bg-blue-800 rounded";
  const itemLink = "px-4 py-1 text-sm text-white hover:bg-blue-800";
  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(o=>!o)} className="px-3 py-2 text-sm font-medium text-white bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 flex items-center gap-1">
        <span>Op. Trésorerie</span><span className="text-[10px] opacity-70">{open?'▲':'▼'}</span>
      </button>
      {open && (
        <div role="menu" className="absolute left-0 mt-2 w-80 bg-blue-900 text-white rounded shadow-lg z-50 p-2 space-y-3 animate-fade-in text-sm">
          <div>
            <button onClick={()=>setOpenCash(o=>!o)} type="button" className={sectionBtn}>
              <span>Caisse</span><span className="text-[10px] opacity-60">{openCash?'−':'+'}</span>
            </button>
            {openCash && (
              <div className="pl-1 flex flex-col">
                <Link href="/authorizations?scope=CASH&flow=OUT" className={itemLink}>Gestion paiements</Link>
                <Link href="/authorizations?scope=CASH&flow=IN" className={itemLink}>Gestion encaissements</Link>
              </div>
            )}
          </div>
          <div>
            <button onClick={()=>setOpenBank(o=>!o)} type="button" className={sectionBtn}>
              <span>Banque</span><span className="text-[10px] opacity-60">{openBank?'−':'+'}</span>
            </button>
            {openBank && (
              <div className="pl-1 flex flex-col">
                <Link href="/authorizations?scope=BANK&flow=OUT" className={itemLink}>Gestion paiements</Link>
                <Link href="/authorizations?scope=BANK&flow=IN" className={itemLink}>Gestion encaissements</Link>
                <Link href="/bank-advices" className={itemLink}>Avis bancaires</Link>
              </div>
            )}
          </div>
          <div>
            <button onClick={()=>setOpenTransfers(o=>!o)} type="button" className={sectionBtn}>
              <span>Transferts</span><span className="text-[10px] opacity-60">{openTransfers?'−':'+'}</span>
            </button>
            {openTransfers && (
              <div className="pl-1 flex flex-col">
                <Link href="/treasury#transfers" className={itemLink}>Historique / Nouveau</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ClientsSub({ salesUnpaid }) {
  const item = "px-4 py-1 text-sm text-white hover:bg-blue-800 flex items-center justify-between";
  return (
    <div className="pl-1 flex flex-col">
      <Link href="/clients/create" className={item}>Créer client</Link>
      <Link href="/clients" className={item}>Liste clients</Link>
      <Link href="/invoices/create" className={item}>Créer facture {salesUnpaid>0 && <Badge count={salesUnpaid} color="red" />}</Link>
      <Link href="/invoices" className={item}>Factures {salesUnpaid>0 && <Badge count={salesUnpaid} color="red" />}</Link>
    </div>
  );
}

function SuppliersSub({ purchaseUnpaid }) {
  const item = "px-4 py-1 text-sm text-white hover:bg-blue-800 flex items-center justify-between";
  return (
    <div className="pl-1 flex flex-col">
      <Link href="/suppliers/create" className={item}>Créer fournisseur</Link>
      <Link href="/suppliers" className={item}>Liste fournisseurs</Link>
      <Link href="/incoming-invoices/create" className={item}>Nouvelle facture reçue {purchaseUnpaid>0 && <Badge count={purchaseUnpaid} color="orange" />}</Link>
      <Link href="/incoming-invoices" className={item}>Factures reçues {purchaseUnpaid>0 && <Badge count={purchaseUnpaid} color="orange" />}</Link>
    </div>
  );
}

function SalesMenu({ salesUnpaid }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(()=>setOpen(false),[]);
  useClickOutside(ref, close, open); useBlurClose(ref, open, close);
  useEffect(()=>{ function onKey(e){ if(e.key==='Escape') close(); } if(open) document.addEventListener('keydown', onKey); return ()=>document.removeEventListener('keydown', onKey); },[open, close]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={()=>setOpen(o=>!o)} className="px-3 py-2 text-sm font-medium text-white bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 flex items-center gap-1">
        <span>Ventes</span><span className="text-[10px] opacity-70">{open?'▲':'▼'}</span>
      </button>
      {open && (
        <div className="absolute left-0 mt-2 w-60 bg-blue-900 text-white rounded shadow-lg z-50 p-2 space-y-1 animate-fade-in text-sm" role="menu">
          <Link href="/clients" className="block px-4 py-1 hover:bg-blue-800" onClick={close}>Clients</Link>
          <Link href="/invoices/create" className="block px-4 py-1 hover:bg-blue-800" onClick={close}>Créer facture {salesUnpaid>0 && <Badge count={salesUnpaid} color="red" />}</Link>
          <Link href="/invoices" className="block px-4 py-1 hover:bg-blue-800" onClick={close}>Factures {salesUnpaid>0 && <Badge count={salesUnpaid} color="red" />}</Link>
          <Link href="/products" className="block px-4 py-1 hover:bg-blue-800" onClick={close}>Produits</Link>
        </div>
      )}
    </div>
  );
}

function PurchasesMenu({ purchaseUnpaid }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(()=>setOpen(false),[]);
  useClickOutside(ref, close, open); useBlurClose(ref, open, close);
  useEffect(()=>{ function onKey(e){ if(e.key==='Escape') close(); } if(open) document.addEventListener('keydown', onKey); return ()=>document.removeEventListener('keydown', onKey); },[open, close]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={()=>setOpen(o=>!o)} className="px-3 py-2 text-sm font-medium text-white bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 flex items-center gap-1">
        <span>Achats</span><span className="text-[10px] opacity-70">{open?'▲':'▼'}</span>
      </button>
      {open && (
        <div className="absolute left-0 mt-2 w-64 bg-blue-900 text-white rounded shadow-lg z-50 p-2 space-y-1 animate-fade-in text-sm" role="menu">
          <Link href="/suppliers" className="block px-4 py-1 hover:bg-blue-800" onClick={close}>Fournisseurs</Link>
          <Link href="/products" className="block px-4 py-1 hover:bg-blue-800" onClick={close}>Produits</Link>
          <Link href="/incoming-invoices/create" className="block px-4 py-1 hover:bg-blue-800" onClick={close}>Créer facture fournisseur {purchaseUnpaid>0 && <Badge count={purchaseUnpaid} color="orange" />}</Link>
          <Link href="/incoming-invoices" className="block px-4 py-1 hover:bg-blue-800" onClick={close}>Factures fournisseurs {purchaseUnpaid>0 && <Badge count={purchaseUnpaid} color="orange" />}</Link>
          <div className="mt-1 border-t border-white/10 pt-1 text-[11px] uppercase tracking-wide opacity-70 px-4">Approvisionnement</div>
          <Link href="/purchase-orders" className="block px-4 py-1 hover:bg-blue-800" onClick={close}>Bons de commande</Link>
          <Link href="/goods-receipts" className="block px-4 py-1 hover:bg-blue-800" onClick={close}>Réceptions</Link>
        </div>
      )}
    </div>
  );
}

export default function NavbarDropdown({ user }) {
  const { salesUnpaid, purchaseUnpaid } = useInvoiceBadges(!!user);
  if (!user) return null;
  const handleLogout = () => {
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('user:logout'));
    const url = new URL(window.location.origin + '/');
    url.searchParams.set('loggedout','1');
    window.location.href = url.toString();
  };
  return (
    <div className="flex items-center gap-2 flex-wrap max-w-full">
      <DashboardMenu onLogout={handleLogout} />
      <AnalyseMenu />
      <TreasuryOperationsMenu />
      <SalesMenu salesUnpaid={salesUnpaid} />
      <PurchasesMenu purchaseUnpaid={purchaseUnpaid} />
    </div>
  );
}
