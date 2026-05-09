import Link from "next/link";
import { HELP_GUIDES } from "@/lib/helpGuides";

export const metadata = {
  title: "Aide utilisateur",
};

export default function HelpPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-950">Aide utilisateur</h1>
        <p className="mt-2 text-sm text-slate-600">
          Guides opératoires des principaux modules. Les références techniques internes ne sont pas affichées ici.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {HELP_GUIDES.map((guide) => (
          <Link
            key={guide.slug}
            href={`/help/${guide.slug}`}
            className="rounded border border-slate-200 bg-white p-4 text-sm shadow-sm hover:border-blue-300 hover:bg-blue-50"
          >
            <span className="font-semibold text-slate-900">{guide.title}</span>
            <span className="mt-2 block text-slate-500">Ouvrir le guide</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
