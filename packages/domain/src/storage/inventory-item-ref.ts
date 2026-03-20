import { z } from 'zod';

export const catalogProductItemRefPrefix = 'product:';

const canonicalProductIdSchema = z.string().uuid().transform((value) => value.toLowerCase());
const catalogProductItemRefPattern =
  /^product:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

export type CatalogProductItemRef = {
  kind: 'catalog-product';
  itemRef: string;
  productId: string;
};

export type LegacyInventoryItemRef = {
  kind: 'legacy';
  itemRef: string;
};

export const catalogProductItemRefSchema = z.string().trim().transform((value, ctx) => {
  const match = catalogProductItemRefPattern.exec(value);

  if (!match) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Expected a catalog-backed item ref in product:<uuid> format.'
    });

    return z.NEVER;
  }

  const productIdResult = canonicalProductIdSchema.safeParse(match[1]);

  if (!productIdResult.success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Expected a valid product UUID in the catalog-backed item ref.'
    });

    return z.NEVER;
  }

  const productId = productIdResult.data;

  return {
    kind: 'catalog-product' as const,
    itemRef: `${catalogProductItemRefPrefix}${productId}`,
    productId
  };
});

export function buildCatalogProductItemRef(productId: string): string {
  return `${catalogProductItemRefPrefix}${canonicalProductIdSchema.parse(productId)}`;
}

export function parseCatalogProductItemRef(itemRef: string | null | undefined): CatalogProductItemRef | null {
  if (typeof itemRef !== 'string') {
    return null;
  }

  const result = catalogProductItemRefSchema.safeParse(itemRef);
  return result.success ? result.data : null;
}

export function isCatalogProductItemRef(itemRef: string | null | undefined): boolean {
  return parseCatalogProductItemRef(itemRef) !== null;
}

export function getCatalogProductId(itemRef: string | null | undefined): string | null {
  return parseCatalogProductItemRef(itemRef)?.productId ?? null;
}

export function classifyInventoryItemRef(
  itemRef: string | null | undefined
): CatalogProductItemRef | LegacyInventoryItemRef | null {
  if (typeof itemRef !== 'string') {
    return null;
  }

  const trimmedItemRef = itemRef.trim();

  if (trimmedItemRef.length === 0) {
    return null;
  }

  return parseCatalogProductItemRef(trimmedItemRef) ?? {
    kind: 'legacy',
    itemRef: trimmedItemRef
  };
}
