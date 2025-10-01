export default function HomeSectionNavSkeleton() {
  const pills = ['A','B','C','D'];
  return (
    <nav aria-label="Navigation interne (chargement)" className="mt-8 mb-12 max-w-5xl mx-auto px-4 animate-pulse">
      <ul className="flex flex-wrap gap-2 sm:gap-4 text-sm">
        {pills.map(p => (
          <li key={p}>
            <span className="inline-block rounded-full border border-slate-200 bg-slate-100/80 text-transparent px-10 py-2 select-none">••••</span>
          </li>
        ))}
        <li className="ml-auto hidden md:block text-xs text-slate-300 self-center">Chargement…</li>
      </ul>
    </nav>
  );
}
