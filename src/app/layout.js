
"use client";

import Footer from "@/components/Footer/Footer";
import Navbar from "@/components/navbar";
import AuthSidebar from "@/components/sidebar/AuthSidebar";
import "./globals.css";
import { AuthorizedFetchProvider } from "@/lib/apiClient";
import { I18nProvider } from "@/lib/i18n";
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

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="antialiased flex flex-col min-h-screen font-sans bg-gray-50">
        <I18nProvider defaultLocale="fr">
          <AuthorizedFetchProvider>
            <Navbar />
            <div className="h-20" aria-hidden="true" />
            <AuthSidebar />
            <div className="flex-1 px-4 md:px-6 pb-24 relative">{children}</div>
            <Footer />
          </AuthorizedFetchProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
