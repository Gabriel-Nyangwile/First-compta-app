"use client";
import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

export default function LogoutToast({ autoHideMs = 5000, fadeOutMs = 180 }) {
  const sp = useSearchParams();
  const [mounted, setMounted] = useState(false); // pour montage initial
  const [closing, setClosing] = useState(false);
  const autoHideRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  const cleanQueryParam = useCallback(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('loggedout')) {
      url.searchParams.delete('loggedout');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const triggerClose = useCallback(() => {
    if (closing) return; // éviter double déclenchement
    cleanQueryParam();
    setClosing(true);
    closeTimeoutRef.current = setTimeout(() => {
      setMounted(false);
    }, fadeOutMs);
  }, [closing, cleanQueryParam, fadeOutMs]);

  useEffect(() => {
    if (sp?.get('loggedout') === '1') {
      setMounted(true);
      autoHideRef.current = setTimeout(() => {
        triggerClose();
      }, autoHideMs);
    }
    return () => {
      if (autoHideRef.current) clearTimeout(autoHideRef.current);
    };
  }, [sp, autoHideMs, triggerClose]);

  // Fallback via event custom
  useEffect(() => {
    function onLogoutToast() {
      setMounted(true);
      if (autoHideRef.current) clearTimeout(autoHideRef.current);
      autoHideRef.current = setTimeout(() => triggerClose(), autoHideMs);
    }
    window.addEventListener('logout:toast', onLogoutToast);
    return () => window.removeEventListener('logout:toast', onLogoutToast);
  }, [autoHideMs, triggerClose]);

  useEffect(() => () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
  }, []);

  if (!mounted) return null;
  const animClass = closing ? 'animate-fade-out' : 'animate-fade-in';
  return (
    <div className={`fixed top-20 right-4 z-[200] ${animClass}`}>
      <div className="bg-green-600 text-white shadow-lg rounded-md px-4 py-3 flex items-start gap-3 w-72 relative overflow-hidden">
        <span className="text-xl select-none">✓</span>
        <div className="flex-1 text-sm leading-snug pr-2">
          <p className="font-semibold mb-1">Déconnexion réussie</p>
          <p className="opacity-90">Vous êtes maintenant déconnecté.</p>
        </div>
        <button onClick={triggerClose} aria-label="Fermer" className="text-white/70 hover:text-white text-sm ml-1 leading-none">×</button>
        {/* Barre de progression visuelle (optionnelle) */}
        <div className="absolute left-0 bottom-0 h-0.5 bg-white/40">
          <div className="h-full bg-white/90" style={{ width: '100%', animation: `shrink ${autoHideMs}ms linear forwards` }} />
        </div>
      </div>
      <style jsx>{`
        @keyframes shrink { from { width:100%; } to { width:0%; } }
      `}</style>
    </div>
  );
}
