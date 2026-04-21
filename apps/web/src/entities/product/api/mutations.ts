import type { ProductPackagingLevel, ProductUnitProfile } from '@wos/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';
import { productKeys } from './queries';

export type UpsertProductUnitProfileBody = {
  unitWeightG?: number | null;
  unitWidthMm?: number | null;
  unitHeightMm?: number | null;
  unitDepthMm?: number | null;
  weightClass?: 'light' | 'medium' | 'heavy' | 'very_heavy' | null;
  sizeClass?: 'small' | 'medium' | 'large' | 'oversized' | null;
};

export type ReplaceProductPackagingLevelItem = {
  id?: string;
  code: string;
  name: string;
  baseUnitQty: number;
  isBase: boolean;
  canPick: boolean;
  canStore: boolean;
  isDefaultPickUom: boolean;
  barcode?: string | null;
  packWeightG?: number | null;
  packWidthMm?: number | null;
  packHeightMm?: number | null;
  packDepthMm?: number | null;
  sortOrder: number;
  isActive: boolean;
};

async function upsertProductUnitProfile(args: {
  productId: string;
  body: UpsertProductUnitProfileBody;
}) {
  return bffRequest<ProductUnitProfile>(`/api/products/${args.productId}/unit-profile`, {
    method: 'PUT',
    body: JSON.stringify(args.body)
  });
}

async function replaceProductPackagingLevels(args: {
  productId: string;
  levels: ReplaceProductPackagingLevelItem[];
}) {
  return bffRequest<ProductPackagingLevel[]>(`/api/products/${args.productId}/packaging-levels`, {
    method: 'PUT',
    body: JSON.stringify(args.levels)
  });
}

export function useUpsertProductUnitProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: upsertProductUnitProfile,
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({
        queryKey: productKeys.unitProfile(variables.productId)
      });
    }
  });
}

export function useReplaceProductPackagingLevels() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: replaceProductPackagingLevels,
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({
        queryKey: productKeys.packagingLevels(variables.productId)
      });
    }
  });
}
