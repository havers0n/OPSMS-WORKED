import { z } from 'zod';

// ── Status & Confidence enums ──────────────────────────────────────────────

export type DeliveryPointStatus = 'active' | 'inactive' | 'needs_review';
export type DeliveryPointAliasConfidence = 'confirmed' | 'review' | 'rejected';

// ── DeliveryPoint schema ────────────────────────────────────────────────────

export const deliveryPointSchema = z.object({
  id: z.string().uuid(),
  sourceType: z.string().trim().min(1),
  sourceExternalId: z.string().trim().min(1),
  officialFuelAdminId: z.string().nullable(),
  displayName: z.string().trim().min(1),
  companyName: z.string().nullable(),
  siteName: z.string().nullable(),
  address: z.string().nullable(),
  municipality: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  status: z.enum(['active', 'inactive', 'needs_review']),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type DeliveryPoint = z.infer<typeof deliveryPointSchema>;

// ── DeliveryPointAlias schema ───────────────────────────────────────────────

export const deliveryPointAliasSchema = z.object({
  id: z.string().uuid(),
  deliveryPointId: z.string().uuid(),
  aliasText: z.string().trim().min(1),
  normalizedAliasText: z.string().trim().min(1),
  aliasSource: z.string().trim().min(1),
  confidence: z.enum(['confirmed', 'review', 'rejected']),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type DeliveryPointAlias = z.infer<typeof deliveryPointAliasSchema>;

// ── Normalization helper ────────────────────────────────────────────────────

export function normalizeDeliveryPointAliasText(input: string): string {
  let s = input;

  // 1. normalize Hebrew maqaf (U+05BE) to hyphen
  s = s.replace(/\u05BE/g, '-');

  // 2. normalize dash variants (U+2010–U+2015, U+2212) to ASCII hyphen
  s = s.replace(/[\u2010-\u2015\u2212]/g, '-');

  // 3. normalize apostrophes and quotes:
  //    - left/right single quotation marks, single low-9, single high-reversed, single guillemets
  s = s.replace(/['\u2018\u2019\u201A\u201B\u2039\u203A]/g, "'");
  //    - left/right double quotation marks, double low-9, double high-reversed, guillemets
  s = s.replace(/["\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"');
  //    - backtick and acute variants → straight apostrophe
  s = s.replace(/[`\u00B4\u02B9\u02BB\u02BC\u02BD\u02C8\u02CA\u02F4\u0374\u055A\u1FBF\u1FFE]/g, "'");

  // 4. normalize Hebrew geresh (U+05F3) and gershayim (U+05F4) to ASCII apostrophe and quote
  s = s.replace(/\u05F3/g, "'");
  s = s.replace(/\u05F4/g, '"');

  // 5. remove Hebrew niqqud (combining marks in U+0591–U+05C7 range)
  s = s.replace(/[\u0591-\u05C7]/g, '');

  // 6. trim
  s = s.trim();

  // 7. collapse repeated whitespace (after potential removals above)
  s = s.replace(/\s+/g, ' ');

  return s;
}
