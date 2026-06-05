import type { Locale } from '@/shared/i18n/translations';

const KNOWN_LEGACY: Record<string, true> = {
  ea: true,
  pcs: true,
  'יח': true,
};

const PCS_LOCALIZED: Record<Locale, string> = {
  en: 'PCS',
  he: 'יח׳',
};

export function resolveUomPresentation(
  rawUom: string | null | undefined,
  locale: Locale
): string {
  if (!rawUom) return '';

  const trimmed = rawUom.trim();
  if (!trimmed) return '';

  const lowered = trimmed.toLowerCase();
  if (lowered === 'pcs' || KNOWN_LEGACY[lowered]) {
    return PCS_LOCALIZED[locale] ?? 'PCS';
  }

  return trimmed;
}
