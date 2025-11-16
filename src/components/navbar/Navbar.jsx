"use client";
import Link from "next/link";
import { useState, useEffect } from "react";

// Navbar minimaliste: après authentification seule la racine (Accueil) et le nom d'utilisateur restent visibles.
// Toute la navigation fonctionnelle est déléguée à la sidebar contextuelle.
export default function Navbar() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const finish = () => { if (!cancelled) setLoadingUser(false); };
    const readUser = () => {
      try {
        const raw = localStorage.getItem('user');
        if (!cancelled) setUser(raw ? JSON.parse(raw) : null);
      } catch {
        if (!cancelled) setUser(null);
      } finally { finish(); }
    };
    readUser();
    // seconde passe après paint (ton pattern initial)
    requestAnimationFrame(readUser);
    const onStorage = (e) => { if (e.key === 'user') { setLoadingUser(true); readUser(); } };
    const onLogin = () => { setLoadingUser(true); readUser(); };
    const onLogout = () => { setLoadingUser(true); readUser(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('user:login', onLogin);
    window.addEventListener('user:logout', onLogout);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('user:login', onLogin);
      window.removeEventListener('user:logout', onLogout);
    };
  }, []);

  const UserSlot = () => {
    if (loadingUser) {
      return (
        <span
          aria-hidden="true"
          className="skeleton-inline skeleton-animated h-4 w-24 sm:w-28"
          style={{ background: 'rgba(255,255,255,0.28)' }}
        />
      );
    }
    if (!user) {
      return (
        <>
          <Link href="/auth/signup" className="hover:text-blue-300">Inscription</Link>
          <Link href="/auth/signin" className="hover:text-blue-300">Connexion</Link>
        </>
      );
    }
    return (
      <span
        className="text-xs sm:text-sm opacity-80 truncate max-w-[140px]"
        title={user.username}
      >{user.username}</span>
    );
  };

  return (
    <nav className="w-full bg-blue-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between shadow fixed top-0 left-0 z-50">
      <div className="flex items-center gap-4 sm:gap-5 flex-wrap">
        <Link href="/" className="font-semibold tracking-wide hover:text-blue-300">Accueil</Link>
      </div>
      <div className="flex items-center gap-3 sm:gap-4 text-sm min-h-[1rem]">
        <UserSlot />
      </div>
    </nav>
  );
}
