import Image from 'next/image';
import Link from 'next/link';
import LogoutToast from '@/components/LogoutToast';
import { HomeSectionNav, HomeSectionNavSkeleton } from '@/components/homeSection';
import { Suspense } from 'react';

export default function HomePage() {
  return (
    <main id="top" className="u-main-container u-padding-content-container scroll-smooth">
      <Suspense fallback={null}>
        <LogoutToast />
      </Suspense>
      <div className="max-w-xl p-8 bg-white rounded shadow text-center">
        <h1 className="text-4xl font-bold mb-4 text-blue-900">SCOFEX Consulting</h1>
        <p className="text-semibold text-gray-700">Bienvenue sur notre site</p>
      </div>
      <Suspense fallback={<HomeSectionNavSkeleton />}> 
        <HomeSectionNav sections={[
          { id: 'about', label: 'À propos' },
          { id: 'services', label: 'Services' },
          { id: 'engagement', label: 'Engagement' },
          { id: 'contact', label: 'Contact' }
        ]} />
      </Suspense>
      {/* Hero */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 py-20 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight text-slate-900">Stratégie. Comptabilité. Excellence.</h1>
            <p className="mt-4 text-slate-600 text-lg">Partenaire de confiance des CEO et grandes entreprises : 30 ans d’expérience cumulée au service de vos décisions clés.</p>
            <div className="mt-6 flex gap-3">
              <Link href="#services" className="rounded-xl px-5 py-3 border border-slate-300 hover:bg-slate-100">Découvrir nos services</Link>
              <Link href="#contact" className="rounded-xl px-5 py-3 bg-slate-900 text-white hover:bg-slate-800">Contactez-nous</Link>
            </div>
          </div>
          <div className="relative">
            {/* Replace src with your hosted image path in /public/images */}
            <div className="w-full rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden relative">
              <Image
                src="/images/image_1.jpg"
                alt="Tableau de bord stratégique"
                width={1200}
                height={800}
                className="w-full h-auto"
                priority
              />
              <div className="absolute inset-0 rounded-2xl bg-white/40" aria-hidden="true" />
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 grid md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1">
            <h2 className="text-2xl font-bold">À propos</h2>
            <ul className="mt-4 space-y-2 text-slate-600 leading-relaxed">
              <li>• 30 ans d’expérience en direction, stratégie et logistique.</li>
              <li>• Accompagnement des CEO et des grandes entreprises.</li>
              <li>• Valeurs : Rigueur • Transparence • Excellence.</li>
              <li>• Mission : Transformer l’expérience en résultats concrets.</li>
            </ul>
          </div>
          <div className="order-1 md:order-2 relative">
            <div className="w-full rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden relative">
              <Image
                src="/images/image_2.jpg"
                alt="Réunion stratégique"
                width={1200}
                height={800}
                className="w-full h-auto"
              />
              <div className="absolute inset-0 rounded-2xl bg-white/40" aria-hidden="true" />
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-6 -mt-8 flex justify-end">
          <a href="#top" className="text-xs inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition" aria-label="Revenir en haut de la page">
            <span className="sm:hidden" aria-hidden="true">↑</span>
            <span className="hidden sm:inline">↑ Haut de page</span>
          </a>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-bold">Services</h2>
          <div className="mt-8 grid md:grid-cols-2 gap-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="aspect-[16/10] relative overflow-hidden rounded-xl ring-1 ring-slate-200">
                <Image
                  src="/images/image_3.jpg"
                  alt="Comptabilité & Reporting"
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-white/40" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Expertise comptable</h3>
              <ul className="mt-2 text-slate-600 space-y-1">
                <li>• Tenue, contrôle, reporting & consolidation.</li>
                <li>• Tableaux de bord, KPI & clôtures.</li>
                <li>• Mise en place de processus et d’outils.</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="aspect-[16/10] relative overflow-hidden rounded-xl ring-1 ring-slate-200">
                <Image
                  src="/images/image_4.png"
                  alt="Fiscalité & Conformité"
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-white/40" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Conseil fiscal</h3>
              <ul className="mt-2 text-slate-600 space-y-1">
                <li>• Conformité et optimisation.</li>
                <li>• Préparation des états financiers.</li>
                <li>• Assistance aux audits et contrôles.</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-6 -mt-8 flex justify-end">
          <a href="#top" className="text-xs inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition" aria-label="Revenir en haut de la page">
            <span className="sm:hidden" aria-hidden="true">↑</span>
            <span className="hidden sm:inline">↑ Haut de page</span>
          </a>
        </div>
      </section>

      {/* Engagement */}
      <section id="engagement" className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 grid md:grid-cols-5 gap-8 items-center">
          <div className="md:col-span-3">
            <h2 className="text-2xl font-bold">Notre engagement</h2>
            <p className="mt-3 text-slate-600">Votre partenaire fiable pour des finances claires et maîtrisées. Confidentialité, professionnalisme et solutions sur mesure orientées résultats durables.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Confidentialité','Professionnalisme','Sur-mesure','Résultats','Durabilité'].map((tag) => (
                <span key={tag} className="rounded-full border border-slate-300 px-3 py-1 text-sm">{tag}</span>
              ))}
            </div>
          </div>
          <div className="md:col-span-2 relative">
            <div className="w-full rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden relative">
              <Image
                src="/images/image_5.jpg"
                alt="Équilibre fiscal et performance"
                width={1200}
                height={800}
                className="w-full h-auto"
              />
              <div className="absolute inset-0 rounded-2xl bg-white/40" aria-hidden="true" />
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-6 -mt-8 flex justify-end">
          <a href="#top" className="text-xs inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition" aria-label="Revenir en haut de la page">
            <span className="sm:hidden" aria-hidden="true">↑</span>
            <span className="hidden sm:inline">↑ Haut de page</span>
          </a>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-bold">Contact</h2>
          <div className="mt-6 grid md:grid-cols-2 gap-8">
            <form className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium">Nom</label>
                <input type="text" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
              <div>
                <label className="block text-sm font-medium">Email</label>
                <input type="email" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
              <div>
                <label className="block text-sm font-medium">Objet</label>
                <input type="text" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
              <div>
                <label className="block text-sm font-medium">Message</label>
                <textarea rows={4} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
              <button type="button" className="rounded-xl bg-slate-900 text-white px-5 py-3 hover:bg-slate-800">Envoyer</button>
            </form>
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-slate-600">
                Email : contact@scofex-consulting.com<br />
                Téléphone : +243 XX XXX XXXX<br />
                Adresse : Kinshasa, RDC
              </p>
              <div className="mt-6 flex gap-3">
                <Link href="#" className="rounded-xl border border-slate-300 px-4 py-2 hover:bg-slate-100">Prendre rendez-vous</Link>
                <Link href="#" className="rounded-xl px-4 py-2 bg-slate-900 text-white hover:bg-slate-800">Parler à un conseiller</Link>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-10 -mt-4 flex justify-end">
          <a href="#top" className="text-xs inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition" aria-label="Revenir en haut de la page">
            <span className="sm:hidden" aria-hidden="true">↑</span>
            <span className="hidden sm:inline">↑ Haut de page</span>
          </a>
        </div>
      </section>

    </main>
  );
}
