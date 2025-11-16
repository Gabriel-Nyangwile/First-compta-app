"use client";
import { useI18n } from '@/lib/i18n';

export default function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="flex gap-2 items-center text-sm">
      <button
        type="button"
        onClick={() => setLocale('fr')}
        className={"px-2 py-1 rounded " + (locale === 'fr' ? 'bg-blue-600 text-white' : 'bg-gray-200')}
      >FR</button>
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={"px-2 py-1 rounded " + (locale === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-200')}
      >EN</button>
    </div>
  );
}
