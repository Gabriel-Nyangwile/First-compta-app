import Link from "next/link";
import { notFound } from "next/navigation";
import MarkdownGuide from "@/components/help/MarkdownGuide";
import { HELP_GUIDES, readHelpGuide } from "@/lib/helpGuides";

export function generateStaticParams() {
  return HELP_GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const guide = HELP_GUIDES.find((item) => item.slug === slug);
  return { title: guide ? `Aide - ${guide.title}` : "Aide" };
}

export default async function HelpGuidePage({ params }) {
  const { slug } = await params;
  const guide = await readHelpGuide(slug);
  if (!guide) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link href="/help" className="text-sm text-blue-700 underline">
          Retour à l'aide
        </Link>
      </div>
      <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
        <MarkdownGuide content={guide.content} />
      </div>
    </main>
  );
}
