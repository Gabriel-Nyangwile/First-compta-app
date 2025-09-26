
"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import NavbarDropdown from "./NavbarDropdown";

export default function Navbar() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const readUser = () => {
      try {
        const raw = localStorage.getItem('user');
        setUser(raw ? JSON.parse(raw) : null);
      } catch {
        setUser(null);
      }
    };
    readUser();
    requestAnimationFrame(() => readUser());
    const onStorage = (e) => { if (e.key === 'user') readUser(); };
    const onLogin = () => readUser();
    const onLogout = () => readUser();
    window.addEventListener('storage', onStorage);
    window.addEventListener('user:login', onLogin);
    window.addEventListener('user:logout', onLogout);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('user:login', onLogin);
      window.removeEventListener('user:logout', onLogout);
    };
  }, []);

  return (
    <nav className="w-full bg-blue-900 text-white px-6 py-3 flex items-center justify-between shadow fixed top-0 left-0 z-50">
      <div className="flex items-center gap-5">
        <Link href="/" className="font-semibold tracking-wide hover:text-blue-300">Accueil</Link>
        {/* Menus marketing retirés volontairement */}
        <NavbarDropdown user={user} />
      </div>
      <div className="flex items-center gap-4 text-sm">
        {!user ? (
          <>
            <Link href="/auth/signup" className="hover:text-blue-300">Inscription</Link>
            <Link href="/auth/signin" className="hover:text-blue-300">Connexion</Link>
          </>
        ) : (
          <span className="text-xs opacity-80">{user.username}</span>
        )}
      </div>
    </nav>
  );
}
