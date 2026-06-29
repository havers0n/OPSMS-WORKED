import type { SupabaseClient } from '@supabase/supabase-js';
import type { DeliveryPoint } from '@wos/domain';
import { deliveryPointSchema, normalizeDeliveryPointAliasText } from '@wos/domain';
import { z } from 'zod';
import { createDeliveryPointsRepo } from './delivery-points-repo.js';

// ── Result types ─────────────────────────────────────────────────────────────

export type DeliveryPointAliasMatchResult =
  | {
      status: 'matched';
      input: string;
      normalizedInput: string;
      deliveryPoint: DeliveryPoint;
    }
  | {
      status: 'unmatched';
      input: string;
      normalizedInput: string;
    }
  | {
      status: 'ambiguous';
      input: string;
      normalizedInput: string;
      message: string;
    };

// ── Zod schemas ──────────────────────────────────────────────────────────────

const matchedResultSchema = z.object({
  status: z.literal('matched'),
  input: z.string(),
  normalizedInput: z.string(),
  deliveryPoint: deliveryPointSchema
});

const unmatchedResultSchema = z.object({
  status: z.literal('unmatched'),
  input: z.string(),
  normalizedInput: z.string()
});

const ambiguousResultSchema = z.object({
  status: z.literal('ambiguous'),
  input: z.string(),
  normalizedInput: z.string(),
  message: z.string()
});

export const deliveryPointAliasMatchResultSchema = z.discriminatedUnion('status', [
  matchedResultSchema,
  unmatchedResultSchema,
  ambiguousResultSchema
]);

export const deliveryPointAliasMatchRequestSchema = z.object({
  aliases: z
    .array(
      z
        .string()
        .min(1, 'Alias must not be empty')
        .refine((s) => s.trim().length > 0, 'Alias must not be whitespace-only')
    )
    .min(1, 'At least one alias is required')
    .max(500, 'Maximum 500 aliases per request')
});

export const deliveryPointAliasMatchResponseSchema = z.object({
  results: z.array(deliveryPointAliasMatchResultSchema)
});

// ── Service type ─────────────────────────────────────────────────────────────

export type DeliveryPointAliasMatchingService = {
  matchAliasExact(aliasText: string): Promise<DeliveryPointAliasMatchResult>;
  matchAliasesExact(aliasTexts: string[]): Promise<DeliveryPointAliasMatchResult[]>;
};

// ── Factory ──────────────────────────────────────────────────────────────────

const AMBIGUOUS_ALIAS_CODE = 'AMBIGUOUS_ALIAS';

function isAmbiguousAliasError(
  error: unknown
): error is Error & { code: string; deliveryPoints: DeliveryPoint[] } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === AMBIGUOUS_ALIAS_CODE
  );
}

export function createDeliveryPointAliasMatchingService(
  supabase: SupabaseClient
): DeliveryPointAliasMatchingService {
  const repo = createDeliveryPointsRepo(supabase);

  async function matchAliasExact(aliasText: string): Promise<DeliveryPointAliasMatchResult> {
    const normalizedInput = normalizeDeliveryPointAliasText(aliasText);

    try {
      const deliveryPoint = await repo.findDeliveryPointByAliasExact(aliasText);

      if (!deliveryPoint) {
        return { status: 'unmatched', input: aliasText, normalizedInput };
      }

      return {
        status: 'matched',
        input: aliasText,
        normalizedInput,
        deliveryPoint
      };
    } catch (error) {
      if (isAmbiguousAliasError(error)) {
        return {
          status: 'ambiguous',
          input: aliasText,
          normalizedInput,
          message: error.message
        };
      }
      throw error;
    }
  }

  async function matchAliasesExact(aliasTexts: string[]): Promise<DeliveryPointAliasMatchResult[]> {
    const uniqueNormalized = new Map<string, { aliasText: string; normalized: string }>();
    for (const text of aliasTexts) {
      const normalized = normalizeDeliveryPointAliasText(text);
      if (!uniqueNormalized.has(normalized)) {
        uniqueNormalized.set(normalized, { aliasText: text, normalized });
      }
    }

    const resolvedMap = new Map<string, DeliveryPointAliasMatchResult>();
    for (const [, entry] of uniqueNormalized) {
      resolvedMap.set(entry.normalized, await matchAliasExact(entry.aliasText));
    }

    const results: DeliveryPointAliasMatchResult[] = [];
    for (const text of aliasTexts) {
      const normalized = normalizeDeliveryPointAliasText(text);
      const resolved = resolvedMap.get(normalized);
      if (resolved) {
        if (resolved.status === 'matched') {
          results.push({
            status: 'matched',
            input: text,
            normalizedInput: normalized,
            deliveryPoint: resolved.deliveryPoint
          });
        } else if (resolved.status === 'ambiguous') {
          results.push({
            status: 'ambiguous',
            input: text,
            normalizedInput: normalized,
            message: resolved.message
          });
        } else {
          results.push({ status: 'unmatched', input: text, normalizedInput: normalized });
        }
      } else {
        results.push({ status: 'unmatched', input: text, normalizedInput: normalized });
      }
    }

    return results;
  }

  return { matchAliasExact, matchAliasesExact };
}
