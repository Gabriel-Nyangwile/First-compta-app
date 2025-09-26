"use client";
import Link from "next/link";
import { useEffect, useState, useRef, useCallback } from 'react';

function Badge({ count, color }) {
  if (count === null || count === 0) return null;
  const colorClasses = {
    red: 'bg-red-600',
    orange: 'bg-orange-600',
    gray: 'bg-gray-500'
  };
  return (
    <span className={`ml-2 inline-block ${colorClasses[color] || colorClasses.gray} text-white text-[10px] px-2 py-0.5 rounded-full`}>{count}</span>
  );
}

// Ligne compacte factures pour affichage badges (optionnel)
function FacturesCompact({ salesUnpaid, purchaseUnpaid }) {
  const total = (salesUnpaid || 0) + (purchaseUnpaid || 0);
  if (!total) return null;
  return (
    <div className="px-4 py-2 text-xs text-gray-600 flex items-center gap-2">
      <span className="uppercase tracking-wide">Factures</span>
      <span className="flex items-center gap-1">
        <Badge count={salesUnpaid} color="red" />
        <Badge count={purchaseUnpaid} color="orange" />
      </span>
    </div>
  );
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
          setSalesUnpaid(c1.count ?? 0);
          setPurchaseUnpaid(c2.count ?? 0);
        }
      } catch {
        if (!cancelled) { setSalesUnpaid(0); setPurchaseUnpaid(0); }
      }
    }
    loadCounts();
    return () => { cancelled = true; };
  }, [active]);
  return { salesUnpaid, purchaseUnpaid };
}

function useClickOutside(ref, handler, enabled=true) {
  useEffect(() => {
    if (!enabled) return;
    function listener(e) {
      if (!ref.current || ref.current.contains(e.target)) return;
      handler();
    }
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler, enabled]);
}

function DashboardMenu({ onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(()=>setOpen(false),[]);
  useClickOutside(ref, close, open);
  useEffect(() => {
    function onKey(e){
      if (e.key === 'Escape') close();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o=>!o)}
        className="px-4 py-2 bg-blue-800 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring focus:ring-blue-400 flex items-center gap-1"
      >
        <span>Dashboard</span>
        <span className="text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div role="menu" className="absolute left-0 mt-2 w-52 bg-white border rounded shadow-lg z-50 py-1 animate-fade-in">
          <Link href="/dashboard" className="block px-4 py-2 hover:bg-blue-100 text-blue-900" onClick={close}>Accueil</Link>
          <Link href="/tiers" className="block px-4 py-2 hover:bg-blue-100 text-blue-900" onClick={close}>Vue Tiers</Link>
          <div className="border-t my-2" />
          <button
            className="block w-full text-left px-4 py-2 text-red-600 hover:bg-red-100"
            onClick={() => { close(); onLogout(); }}
          >Se déconnecter</button>
        </div>
      )}
    </div>
  );
}

function AnalyseMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(()=>setOpen(false),[]);
  useClickOutside(ref, close, open);
  useEffect(()=>{
    function onKey(e){ if(e.key==='Escape') close(); }
    if (open) document.addEventListener('keydown', onKey);
    return ()=> document.removeEventListener('keydown', onKey);
  },[open, close]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={()=>setOpen(o=>!o)}
        className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 focus:outline-none focus:ring focus:ring-gray-400 flex items-center gap-1"
      >
        <span>Analyse</span>
        <span className="text-xs">{open?'▲':'▼'}</span>
      </button>
      {open && (
        <div role="menu" className="absolute left-0 mt-2 w-56 bg-white border rounded shadow-lg z-50 py-1 animate-fade-in">
          <Link href="/transactions" className="block px-4 py-2 hover:bg-blue-100 text-blue-900" onClick={close}>Transactions</Link>
          <Link href="/vat-recap" className="block px-4 py-2 hover:bg-blue-100 text-blue-900" onClick={close}>Récap TVA</Link>
          <Link href="/treasury" className="block px-4 py-2 hover:bg-blue-100 text-blue-900" onClick={close}>Trésorerie</Link>
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
  useClickOutside(ref, close, open);
  useEffect(()=>{
    function onKey(e){ if (e.key==='Escape') close(); }
    if (open) document.addEventListener('keydown', onKey);
    return ()=> document.removeEventListener('keydown', onKey);
  },[open, close]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(o=>!o)} className="px-4 py-2 bg-teal-700 text-white rounded hover:bg-teal-600 focus:outline-none focus:ring focus:ring-teal-400 flex items-center gap-1">
        <span>Op. Trésorerie</span>
        <span className="text-xs">{open?'▲':'▼'}</span>
      </button>
      {open && (
        <div role="menu" className="absolute left-0 mt-2 w-80 bg-white border rounded shadow-lg z-50 p-2 space-y-3 animate-fade-in text-sm">
          <div>
            <button onClick={()=>setOpenCash(o=>!o)} type="button" className="w-full flex items-center justify-between px-2 py-1 font-semibold text-teal-800 hover:bg-teal-50 rounded">
              <span>Caisse</span><span className="text-xs text-gray-500">{openCash?'−':'+'}</span>
            </button>
            {openCash && (
              <div className="pl-2 flex flex-col">
                <Link href="/authorizations?scope=CASH&flow=OUT" className="px-3 py-1 hover:bg-teal-50 text-teal-900">Gestion paiements</Link>
                <Link href="/authorizations?scope=CASH&flow=IN" className="px-3 py-1 hover:bg-teal-50 text-teal-900">Gestion encaissements</Link>
              </div>
            )}
          </div>
          <div>
            <button onClick={()=>setOpenBank(o=>!o)} type="button" className="w-full flex items-center justify-between px-2 py-1 font-semibold text-teal-800 hover:bg-teal-50 rounded">
              <span>Banque</span><span className="text-xs text-gray-500">{openBank?'−':'+'}</span>
            </button>
            {openBank && (
              <div className="pl-2 flex flex-col">
                <Link href="/authorizations?scope=BANK&flow=OUT" className="px-3 py-1 hover:bg-teal-50 text-teal-900">Gestion paiements</Link>
                <Link href="/authorizations?scope=BANK&flow=IN" className="px-3 py-1 hover:bg-teal-50 text-teal-900">Gestion encaissements</Link>
                <Link href="/bank-advices" className="px-3 py-1 hover:bg-teal-50 text-teal-900">Avis bancaires</Link>
              </div>
            )}
          </div>
          <div>
            <button onClick={()=>setOpenTransfers(o=>!o)} type="button" className="w-full flex items-center justify-between px-2 py-1 font-semibold text-teal-800 hover:bg-teal-50 rounded">
              <span>Transferts</span><span className="text-xs text-gray-500">{openTransfers?'−':'+'}</span>
            </button>
            {openTransfers && (
              <div className="pl-2 flex flex-col">
                <Link href="/treasury#transfers" className="px-3 py-1 hover:bg-teal-50 text-teal-900">Historique / Nouveau</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ClientsSub({ salesUnpaid }) {
  return (
    <div className="pl-2 flex flex-col text-sm">
      <Link href="/clients/create" className="px-4 py-1 hover:bg-blue-50 text-blue-900">Créer client</Link>
      <Link href="/clients" className="px-4 py-1 hover:bg-blue-50 text-blue-900">Liste clients</Link>
      <Link href="/invoices/create" className="px-4 py-1 hover:bg-blue-50 text-blue-900 flex items-center justify-between">Créer facture {salesUnpaid>0 && <Badge count={salesUnpaid} color="red" />}</Link>
      <Link href="/invoices" className="px-4 py-1 hover:bg-blue-50 text-blue-900 flex items-center justify-between">Factures {salesUnpaid>0 && <Badge count={salesUnpaid} color="red" />}</Link>
    </div>
  );
}

function SuppliersSub({ purchaseUnpaid }) {
  return (
    <div className="pl-2 flex flex-col text-sm">
      <Link href="/suppliers/create" className="px-4 py-1 hover:bg-blue-50 text-blue-900">Créer fournisseur</Link>
      <Link href="/suppliers" className="px-4 py-1 hover:bg-blue-50 text-blue-900">Liste fournisseurs</Link>
      <Link href="/incoming-invoices/create" className="px-4 py-1 hover:bg-blue-50 text-blue-900 flex items-center justify-between">Nouvelle facture reçue {purchaseUnpaid>0 && <Badge count={purchaseUnpaid} color="orange" />}</Link>
      <Link href="/incoming-invoices" className="px-4 py-1 hover:bg-blue-50 text-blue-900 flex items-center justify-between">Factures reçues {purchaseUnpaid>0 && <Badge count={purchaseUnpaid} color="orange" />}</Link>
    </div>
  );
}

function TiersMenu({ salesUnpaid, purchaseUnpaid }) {
  const [open, setOpen] = useState(false);
  const [openClients, setOpenClients] = useState(true);
  const [openSuppliers, setOpenSuppliers] = useState(true);
  const ref = useRef(null);
  const close = useCallback(()=>setOpen(false),[]);
  useClickOutside(ref, close, open);
  useEffect(()=>{
    function onKey(e){ if (e.key==='Escape') close(); }
    if (open) document.addEventListener('keydown', onKey);
    return ()=> document.removeEventListener('keydown', onKey);
  }, [open, close]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={()=>setOpen(o=>!o)}
        className="px-4 py-2 bg-indigo-700 text-white rounded hover:bg-indigo-600 focus:outline-none focus:ring focus:ring-indigo-400 flex items-center gap-1"
      >
        <span>Tiers</span>
        <span className="text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div role="menu" className="absolute left-0 mt-2 w-72 bg-white border rounded shadow-lg z-50 p-2 space-y-2 animate-fade-in">
          <div>
            <button type="button" onClick={()=>setOpenClients(o=>!o)} className="w-full flex items-center justify-between px-2 py-1 font-semibold text-blue-900 hover:bg-blue-50 rounded">
              <span>Clients</span>
              <span className="text-xs text-gray-500">{openClients? '−':'+'}</span>
            </button>
            {openClients && <ClientsSub salesUnpaid={salesUnpaid||0} />}
          </div>
          <div>
            <button type="button" onClick={()=>setOpenSuppliers(o=>!o)} className="w-full flex items-center justify-between px-2 py-1 font-semibold text-blue-900 hover:bg-blue-50 rounded">
              <span>Fournisseurs</span>
              <span className="text-xs text-gray-500">{openSuppliers? '−':'+'}</span>
            </button>
            {openSuppliers && <SuppliersSub purchaseUnpaid={purchaseUnpaid||0} />}
          </div>
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
    <div className="flex items-center gap-4">
      <DashboardMenu onLogout={handleLogout} />
      <AnalyseMenu />
      <TreasuryOperationsMenu />
      <TiersMenu salesUnpaid={salesUnpaid} purchaseUnpaid={purchaseUnpaid} />
    </div>
  );
}
