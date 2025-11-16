"use client";
import { createContext, useContext, useMemo, useState } from 'react';
import fr from '@/locales/fr.json';
import en from '@/locales/en.json';

const catalogs = { fr, en };

const I18nContext = createContext({
  locale: 'fr',
  t: (key) => key,
  setLocale: () => {},
});

export function I18nProvider({ defaultLocale = 'fr', children }) {
  const [locale, setLocale] = useState(defaultLocale);
  const dict = catalogs[locale] || catalogs.fr;

  const t = useMemo(() => {
    return (key, fallback) => {
      const parts = key.split('.');
      let cur = dict;
      for (const p of parts) {
        if (cur && typeof cur === 'object' && p in cur) cur = cur[p];
        else { cur = undefined; break; }
      }
      const val = (typeof cur === 'string') ? cur : undefined;
      return val ?? fallback ?? key;
    };
  }, [dict]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);
  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
