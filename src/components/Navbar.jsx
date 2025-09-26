
"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import NavbarDropdown from "./NavbarDropdown";
import Image from "next/image";

export default function Navbar() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const readUser = () => {
      try {
        const raw = localStorage.getItem('user');
        setUser(raw ? JSON.parse(raw) : null);
      } catch (e) {
        setUser(null);
      }
    };
    // Lecture initiale asap (cas SSR hydration)
    readUser();
    // Double flush après paint pour capter un setItem déclenché pendant le montage
    requestAnimationFrame(() => readUser());
    // Écoute storage (autres onglets)
    const onStorage = (e) => {
      if (e.key === 'user') {
        readUser();
      }
    };
    window.addEventListener('storage', onStorage);
    // Écoute event custom dispatché après login local
    const onUserLogin = () => readUser();
    window.addEventListener('user:login', onUserLogin);
    const onUserLogout = () => readUser();
    window.addEventListener('user:logout', onUserLogout);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('user:login', onUserLogin);
      window.removeEventListener('user:logout', onUserLogout);
    };
  }, []);

  return (
    <nav className="w-full bg-blue-900 text-white px-6 py-3 flex items-center justify-between shadow fixed top-0 left-0 z-50">
      <div className="flex items-center gap-4">
        <Link href="/" className="font-normal hover:text-blue-300">
          Accueil
        </Link>
        <Link href="#about" className="hover:text-blue-300 text-center">Qui sommes-nous?</Link>
        <Link href="#services" className="hover:text-blue-300">Services</Link>
        <Link href="#engagement" className="hover:text-blue-300">Engagement</Link>
        <Link href="#contact" className="hover:text-blue-300">Contact</Link>
        <Link href="#contact" className="inline-flex items-center rounded-2xl border-none border-slate-300 px-4 py-2 text-sm font-medium text-center hover:bg-blue-300">
          Prendre rendez-vous
        </Link>
        <NavbarDropdown user={user} />
      </div>
      <div>
        {!user ? (
          <>
            <Link href="/auth/signup" className="mr-4 hover:text-blue-300">Inscription</Link>
            <Link href="/auth/signin" className="hover:text-blue-300">Connexion</Link>
          </>
        ) : (
          <span className="text-sm text-center">{user.username}</span>
        )}
      </div>
    </nav>
  );
}
