import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  type Locale,
  translations,
  getStoredLocale,
  setStoredLocale,
} from './translations';

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    setStoredLocale(next);
  }, []);

  const t = useCallback(
    (key: string): string => {
      const dict = translations[locale];
      if (dict && key in dict) return dict[key];
      const en = translations.en;
      if (en && key in en) return en[key];
      return key;
    },
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}

export function useT(): (key: string) => string {
  return useLocale().t;
}
