import { classifyInventoryItemRef, type Product } from '@wos/domain';

function isDirectlyDisplayableImageSource(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;

  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/')
  );
}

export function resolveProductDisplayImages(product: Product | null | undefined): string[] {
  if (!product) return [];

  const orderedSources = [...product.imageUrls, ...product.imageFiles];
  const seen = new Set<string>();
  const displayable: string[] = [];

  for (const source of orderedSources) {
    const normalized = source.trim();
    if (!normalized) continue;
    if (!isDirectlyDisplayableImageSource(normalized)) continue;
    if (seen.has(normalized)) continue;

    seen.add(normalized);
    displayable.push(normalized);
  }

  return displayable;
}

export function getProductImageUrl(product: Product | null | undefined) {
  return resolveProductDisplayImages(product)[0] ?? null;
}

export function getProductLabel(itemRef: string, product: Product | null | undefined) {
  return product?.name ?? itemRef;
}

export function getProductMeta(itemRef: string, product: Product | null | undefined) {
  if (!product) {
    const ref = classifyInventoryItemRef(itemRef);

    if (ref?.kind === 'catalog-product') {
      return 'Catalog product unavailable';
    }

    if (ref?.kind === 'legacy') {
      return 'Legacy reference';
    }

    return null;
  }

  return product.sku ?? product.externalProductId;
}
