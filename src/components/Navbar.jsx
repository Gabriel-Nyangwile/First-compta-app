
"use client";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function Navbar() {
  // Version épurée : uniquement navigation interne page d'accueil
  const [menuOpen, setMenuOpen] = useState(false);
  // Gestion simple du scroll lock sur mobile
  useEffect(()=> {
    if (menuOpen) document.body.style.overflow='hidden'; else document.body.style.overflow='';
  },[menuOpen]);

  const links = [
    { href: '#about', label: 'À propos' },
    { href: '#services', label: 'Services' },
    { href: '#engagement', label: 'Engagement' },
    { href: '#contact', label: 'Contact' },
  ];

  return (
    <nav className="w-full bg-blue-900 text-white px-4 md:px-6 py-3 flex items-center justify-between shadow fixed top-0 left-0 z-50">
      <div className="flex items-center gap-6">
        <Link href="/" className="font-semibold tracking-wide hover:text-blue-300">SCOFEX</Link>
        <div className="hidden md:flex items-center gap-5 text-sm">
          {links.map(l => (
            <a key={l.href} href={l.href} className="hover:text-blue-300 transition-colors">{l.label}</a>
          ))}
          <a href="#contact" className="inline-flex items-center rounded-full bg-white/10 hover:bg-white/20 px-4 py-1.5 text-xs font-medium border border-white/20 backdrop-blur">
            Rendez-vous
          </a>
        </div>
      </div>
      <button
        className="md:hidden inline-flex items-center justify-center rounded-md border border-white/30 px-3 py-2 text-xs hover:bg-white/10"
        onClick={()=>setMenuOpen(o=>!o)}
        aria-expanded={menuOpen}
        aria-label="Menu"
      >{menuOpen ? 'Fermer' : 'Menu'}</button>
      {menuOpen && (
        <div className="absolute top-full left-0 w-full bg-blue-900/95 backdrop-blur border-t border-white/10 px-4 py-6 flex flex-col gap-4 md:hidden">
          {links.map(l => (
            <a key={l.href} href={l.href} onClick={()=>setMenuOpen(false)} className="block text-sm tracking-wide hover:text-blue-300">{l.label}</a>
          ))}
          <a href="#contact" onClick={()=>setMenuOpen(false)} className="mt-2 inline-flex items-center justify-center rounded-full bg-white text-blue-900 px-5 py-2 text-sm font-semibold shadow hover:bg-blue-50">Prendre rendez-vous</a>
        </div>
      )}
    </nav>
  );
}
