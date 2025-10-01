"use client";
import { useEffect, useState, useRef, useCallback } from 'react';

/**
 * Scroll spy navigation for the home page sections.
 * Highlights the currently visible section link.
 */
export default function HomeSectionNav({ sections }) {
  const [active, setActive] = useState(sections?.[0]?.id || null);
  const observerRef = useRef(null);

  const initObserver = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    const opts = { root: null, rootMargin: '0px 0px -45% 0px', threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] };
    const visibleMap = new Map();
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          visibleMap.set(entry.target.id, entry.intersectionRatio);
        } else {
          visibleMap.delete(entry.target.id);
        }
      });
      if (visibleMap.size) {
        // pick the section with highest ratio, fallback to first inserted order
        let topId = null; let topRatio = -1;
        for (const [id, ratio] of visibleMap.entries()) {
          if (ratio > topRatio) { topRatio = ratio; topId = id; }
        }
        if (topId && topId !== active) setActive(topId);
      }
    }, opts);

    sections.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observerRef.current.observe(el);
    });
  }, [sections, active]);

  useEffect(() => {
    if (!sections?.length) return;
    initObserver();
    return () => { observerRef.current?.disconnect(); };
  }, [initObserver, sections]);

  return (
    <nav aria-label="Navigation interne" className="mt-8 mb-12 max-w-5xl mx-auto px-4">
      <ul className="flex flex-wrap gap-2 sm:gap-4 text-sm">
        {sections.map(s => {
          const isActive = active === s.id;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={isActive ? 'true' : undefined}
                className={`inline-block rounded-full border px-4 py-2 transition focus:outline-none focus:ring-2 focus:ring-slate-400 ${isActive ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'border-slate-300 bg-white/70 backdrop-blur text-slate-700 hover:bg-slate-100'}`}
              >
                {s.label}
              </a>
            </li>
          );
        })}
        <li className="ml-auto hidden md:block text-xs text-slate-500 self-center">Cliquez pour accéder directement à une section ↓</li>
      </ul>
    </nav>
  );
}
