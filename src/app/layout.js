
"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer/Footer";
import "./globals.css";
// --- Intégration polices locales ---
// Étapes pour activer next/font/local :
// 1. Déposer vos fichiers WOFF2 dans /public/fonts (ex: Inter-Regular.woff2, Inter-SemiBold.woff2)
// 2. Décommenter le bloc ci-dessous et ajuster les chemins + poids.
// 3. Remplacer className `font-sans` par la variable générée (ex: inter.variable) si vous utilisez des CSS vars.
// 4. Option alternative : définir @font-face directement dans globals.css (voir README section Polices Locales).
//
// import localFont from "next/font/local";
// const inter = localFont({
//   src: [
//     { path: "../../public/fonts/Inter-Regular.woff2", weight: "400", style: "normal" },
//     { path: "../../public/fonts/Inter-Medium.woff2", weight: "500", style: "normal" },
//     { path: "../../public/fonts/Inter-SemiBold.woff2", weight: "600", style: "normal" },
//     { path: "../../public/fonts/Inter-Bold.woff2", weight: "700", style: "normal" }
//   ],
//   display: "swap",
//   variable: "--font-sans"
// });
// NOTE: Google font fetching caused build failures (offline / CI without external access).
// We switch to a local font strategy placeholder. Place your font files under /public/fonts
// and declare them via @font-face in globals.css or by using next/font/local if later desired.
// CSS variables used below emulate previous --font-geist-* usage.

import { useEffect, useState } from "react";

export default function RootLayout({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Exemple : récupération de l'utilisateur depuis le localStorage
    const stored = localStorage.getItem("user");
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  return (
    <html lang="fr">
      <body
        className={`antialiased flex flex-col min-h-screen font-sans`}
      >
        <Navbar user={user} />
        {/* Spacer to offset fixed navbar height (~60px) */}
        <div className="h-20" aria-hidden="true" />
        <div className="flex-1 px-4 md:px-6 pb-24">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
