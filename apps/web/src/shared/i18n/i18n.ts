import { BffRequestError } from '@/shared/api/bff/client';
import {
  defaultLocale,
  dictionaries,
  en,
  fallbackLocale,
  type Locale,
  type TranslationKey,
  type TranslationParams
} from './translations';

const interpolationPattern = /\{([a-zA-Z0-9_]+)\}/g;

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'he' || value === 'en';
}

export function interpolate(message: string, params?: TranslationParams): string {
  if (!params) return message;

  return message.replace(interpolationPattern, (match, key: string) => {
    const value = params[key];
    return value === null || value === undefined ? match : String(value);
  });
}

export function translate(
  key: TranslationKey,
  params?: TranslationParams,
  locale: Locale = defaultLocale
): string {
  const template = dictionaries[locale][key] ?? dictionaries[fallbackLocale][key] ?? en[key];
  return interpolate(template, params);
}

export function createTranslator(locale: Locale = defaultLocale) {
  return (key: TranslationKey, params?: TranslationParams) => translate(key, params, locale);
}

export function formatNumber(value: number, locale: Locale = defaultLocale): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatDateTime(
  value: string | number | Date,
  locale: Locale = defaultLocale,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }
): string {
  return new Intl.DateTimeFormat(locale, options).format(new Date(value));
}

function diagnosticFallback(error: BffRequestError): string {
  if (error.requestId) {
    return translate('error.withRequestId', { requestId: error.requestId });
  }
  if (error.errorId) {
    return translate('error.withErrorId', { errorId: error.errorId });
  }
  return translate('error.generic');
}

export function translateBffError(error: unknown): string {
  if (!(error instanceof BffRequestError)) {
    return error instanceof Error ? error.message : translate('error.generic');
  }

  const key = error.code ? (`error.${error.code}` as TranslationKey) : null;
  if (key && key in en) {
    return translate(key);
  }

  return diagnosticFallback(error);
}
