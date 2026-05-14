import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import LogoutToast from "@/components/LogoutToast";
import { HomeSectionNav, HomeSectionNavSkeleton } from "@/components/homeSection";

const sections = [
  { id: "plateforme", label: "Plateforme" },
  { id: "cycles", label: "Cycles métier" },
  { id: "controle", label: "Contrôle" },
  { id: "scofex", label: "SCOFEX" },
];

const capabilities = [
  {
    title: "Vendre, encaisser, lettrer",
    text: "De la commande client au règlement, Mizani garde le lien entre opération, facture, journal et grand livre.",
  },
  {
    title: "Acheter, recevoir, valoriser",
    text: "Bons de commande, réceptions, retours, factures fournisseurs et CUMP avancent dans un même flux contrôlé.",
  },
  {
    title: "Payer, poster, rapprocher",
    text: "Trésorerie, paie, autorisations et règlements produisent une trace comptable lisible et vérifiable.",
  },
];

const proofPoints = [
  "Multi-société avec accès isolés",
  "Journal et grand livre alimentés par les flux",
  "Packs d'audit prêts pour la release",
  "Guides intégrés dans le menu Aide",
];

export default function HomePage() {
  return (
    <main id="top" className="scroll-smooth bg-white text-slate-950">
      <Suspense fallback={null}>
        <LogoutToast />
      </Suspense>

      <section className="relative min-h-[88vh] overflow-hidden bg-slate-950">
        <Image
          src="/images/mizani/hero.webp"
          alt="Équipe financière utilisant Mizani"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-slate-950/58" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-950/55 to-transparent" aria-hidden="true" />
        <div className="relative mx-auto flex min-h-[88vh] max-w-6xl flex-col justify-center px-4 pb-20 pt-28">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">
            Une solution SCOFEX Consulting
          </p>
          <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[1.02] text-white md:text-7xl">
            Mizani
          </h1>
          <p className="mt-4 max-w-2xl text-2xl font-semibold text-white md:text-3xl">
            L'entreprise en équilibre.
          </p>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-100 md:text-lg">
            Comptabilité, paie, stock, trésorerie et production reliés dans un seul système multi-société. Chaque mouvement métier laisse une trace comptable contrôlable.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/auth/signin"
              className="inline-flex items-center justify-center rounded-md bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-sm hover:bg-emerald-300"
            >
              Entrer dans Mizani
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center rounded-md border border-white/70 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
            >
              Demander un accès
            </Link>
          </div>
        </div>
      </section>

      <Suspense fallback={<HomeSectionNavSkeleton />}>
        <HomeSectionNav sections={sections} />
      </Suspense>

      <section id="plateforme" className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Plateforme unifiée</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-black leading-tight text-slate-950 md:text-5xl">
              Du geste métier au journal, sans rupture.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
              Mizani relie les équipes opérationnelles et la comptabilité. Une réception de stock, un règlement fournisseur, une paie ou une sortie de production ne reste pas un événement isolé: le contrôle comptable suit.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {proofPoints.map((item) => (
                <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-800">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200">
            <Image
              src="/images/mizani/operations.webp"
              alt="Flux opérationnels connectés à la comptabilité"
              fill
              sizes="(min-width: 1024px) 44vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section id="cycles" className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Cycles métier</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-slate-950 md:text-5xl">
              Une application pour suivre l'entreprise réelle.
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {capabilities.map((item) => (
              <article key={item.title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.text}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <ImagePanel src="/images/mizani/multi-company.webp" alt="Gestion multi-société" label="Multi-société" />
            <ImagePanel src="/images/mizani/stock.webp" alt="Stock et production" label="Stock et production" />
            <ImagePanel src="/images/mizani/human-resources.webp" alt="Personnel et paie" label="Personnel et paie" />
          </div>
        </div>
      </section>

      <section id="controle" className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 lg:order-1">
            <Image
              src="/images/mizani/treasury.webp"
              alt="Trésorerie et contrôle financier"
              fill
              sizes="(min-width: 1024px) 44vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="lg:order-2">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Contrôle et confiance</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-black leading-tight text-slate-950 md:text-5xl">
              La rigueur n'arrive pas en fin de mois. Elle accompagne chaque opération.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
              Les packs d'audit, la séparation des sociétés, les statuts métier et les écritures équilibrées donnent au comptable un système qui explique ce qu'il fait.
            </p>
            <div className="mt-8 border-l-4 border-emerald-500 pl-5">
              <p className="text-xl font-bold leading-8 text-slate-900">
                Mizani ne remplace pas le comptable. Il lui donne un système qui travaille proprement avec lui.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="scofex" className="relative overflow-hidden bg-slate-950">
        <Image
          src="/images/mizani/trust.webp"
          alt="Dirigeant et comptable en environnement professionnel"
          fill
          sizes="100vw"
          className="object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-slate-950/60" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-4 py-20">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-200">SCOFEX Consulting</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-white md:text-5xl">
              Une plateforme née du terrain comptable, pas d'une promesse abstraite.
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-100">
              Mizani prolonge l'exigence de SCOFEX Consulting: transformer l'expérience financière en décisions, en contrôles et en résultats exploitables.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth/signin"
                className="inline-flex items-center justify-center rounded-md bg-white px-5 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-100"
              >
                Se connecter
              </Link>
              <Link
                href="/help"
                className="inline-flex items-center justify-center rounded-md border border-white/70 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
              >
                Voir les guides
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function ImagePanel({ src, alt, label }) {
  return (
    <figure className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="relative aspect-[16/11]">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(min-width: 768px) 33vw, 100vw"
          className="object-cover"
        />
      </div>
      <figcaption className="px-4 py-3 text-sm font-semibold text-slate-800">{label}</figcaption>
    </figure>
  );
}
