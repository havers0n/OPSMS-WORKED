import { classifyInventoryItemRef, type Product } from '@wos/domain';

export function getProductImageUrl(product: Product | null | undefined) {
  return product?.imageUrls[0] ?? null;
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
