import { classifyInventoryItemRef, type Product } from '@wos/domain';

function normalizeDisplayableImageSrc(value: string | null | undefined) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/')
  ) {
    return trimmed;
  }

  return null;
}

export function resolveProductPrimaryImage(product: Product | null | undefined) {
  const imageUrl = normalizeDisplayableImageSrc(product?.imageUrls[0] ?? null);
  if (imageUrl) return imageUrl;

  if ((product?.imageUrls.length ?? 0) > 0) {
    return null;
  }

  const imageFile = normalizeDisplayableImageSrc(product?.imageFiles[0] ?? null);
  if (imageFile) return imageFile;

  return null;
}

export function resolveProductPermalink(product: Product | null | undefined) {
  if (typeof product?.permalink !== 'string') return null;

  const trimmed = product.permalink.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return null;
  }

  return trimmed;
}

export function getProductImageUrl(product: Product | null | undefined) {
  return resolveProductPrimaryImage(product);
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
