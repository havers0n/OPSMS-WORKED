import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { createTranslator } from './i18n';
import {
  defaultLocale,
  fallbackLocale,
  type Locale,
  type TranslationKey,
  type TranslationParams
} from './translations';

type I18nContextValue = {
  locale: Locale;
  fallbackLocale: Locale;
  dir: 'rtl' | 'ltr';
  t: (key: TranslationKey, params?: TranslationParams) => string;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);
const LOCALE_STORAGE_KEY = 'wos:locale';

function isLocale(value: string | null | undefined): value is Locale {
  return value === 'he' || value === 'en';
}

function readStoredLocale(fallback: Locale): Locale {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredLocale(locale: Locale) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Locale changes can still apply for the current session when storage is unavailable.
  }
}

const defaultContextValue: I18nContextValue = {
  locale: defaultLocale,
  fallbackLocale,
  dir: 'rtl',
  t: createTranslator(defaultLocale),
  setLocale: () => undefined
};

export function I18nProvider({
  children,
  locale = defaultLocale
}: PropsWithChildren<{ locale?: Locale }>) {
  const [selectedLocale, setSelectedLocale] = useState<Locale>(() => readStoredLocale(locale));
  const dir = selectedLocale === 'he' ? 'rtl' : 'ltr';
  const setLocale = useCallback((nextLocale: Locale) => {
    writeStoredLocale(nextLocale);
    setSelectedLocale(nextLocale);
  }, []);
  const value = useMemo<I18nContextValue>(
    () => ({
      locale: selectedLocale,
      fallbackLocale,
      dir,
      t: createTranslator(selectedLocale),
      setLocale
    }),
    [dir, selectedLocale, setLocale]
  );

  useEffect(() => {
    document.documentElement.lang = selectedLocale;
    document.documentElement.dir = dir;
  }, [dir, selectedLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext) ?? defaultContextValue;
}

export function useT() {
  return useI18n().t;
}
