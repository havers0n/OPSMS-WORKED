import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product, ProductUnitProfile, ProductPackagingLevel } from '@wos/domain';
import {
  createProductsRepo,
  type ProductCatalogQuery,
  type ProductCatalogPage,
  type UpsertUnitProfileData,
  type CreatePackagingLevelData,
  type PatchPackagingLevelData,
  type ProductsRepo
} from './repo.js';
import { ApiError } from '../../errors.js';
import {
  assertFinalPackagingState,
  assertBaseRowPreserved,
  type PackagingLevelInput
} from './packaging-validation.js';

export type ProductsService = {
  findCatalog(args: ProductCatalogQuery): Promise<ProductCatalogPage>;
  searchActive(query: string, limit?: number): Promise<Product[]>;
  listActive(limit?: number): Promise<Product[]>;
  findById(productId: string): Promise<Product | null>;
  findUnitProfile(productId: string): Promise<ProductUnitProfile | null>;
  upsertUnitProfile(productId: string, data: UpsertUnitProfileData): Promise<ProductUnitProfile>;
  findPackagingLevels(productId: string): Promise<ProductPackagingLevel[]>;
  /** Atomic replace via DB RPC. Validates final state before RPC call as a fast-rejection layer. */
  setPackagingLevels(productId: string, levels: PackagingLevelInput[]): Promise<ProductPackagingLevel[]>;
  createPackagingLevel(productId: string, data: CreatePackagingLevelData): Promise<ProductPackagingLevel>;
  updatePackagingLevel(productId: string, levelId: string, data: PatchPackagingLevelData): Promise<ProductPackagingLevel>;
  deletePackagingLevel(productId: string, levelId: string): Promise<void>;
};

/** Testable factory — accepts an already-constructed repo. */
export function createProductsServiceFromRepo(repo: ProductsRepo): ProductsService {
  async function assertProductExists(productId: string): Promise<void> {
    const product = await repo.findById(productId);
    if (!product) throw new ApiError(404, 'NOT_FOUND', 'Product was not found.');
  }

  async function assertLevelExists(productId: string, levelId: string): Promise<void> {
    const levels = await repo.findPackagingLevels(productId);
    if (!levels.some((l) => l.id === levelId)) {
      throw new ApiError(404, 'NOT_FOUND', 'Packaging level was not found.');
    }
  }

  /** Single-operation guard: no duplicate base/default/code on add. */
  function validateSingleWrite(
    incoming: CreatePackagingLevelData | PatchPackagingLevelData,
    existingLevels: ProductPackagingLevel[],
    excludeId?: string
  ): void {
    const others = excludeId ? existingLevels.filter((l) => l.id !== excludeId) : existingLevels;

    if ('isBase' in incoming && incoming.isBase === true && others.some((l) => l.isBase)) {
      throw new ApiError(409, 'DUPLICATE_BASE_ROW', 'A base packaging level already exists for this product.');
    }
    if (
      'isDefaultPickUom' in incoming &&
      incoming.isDefaultPickUom === true &&
      others.some((l) => l.isDefaultPickUom)
    ) {
      throw new ApiError(409, 'DUPLICATE_DEFAULT_PICK', 'A default pick UOM already exists for this product.');
    }
    if (
      'isBase' in incoming &&
      incoming.isBase &&
      'baseUnitQty' in incoming &&
      incoming.baseUnitQty !== undefined &&
      incoming.baseUnitQty !== 1
    ) {
      throw new ApiError(422, 'BASE_UNIT_QTY_INVALID', 'Base packaging level must have baseUnitQty = 1.');
    }
    if (
      'isDefaultPickUom' in incoming &&
      incoming.isDefaultPickUom &&
      'isActive' in incoming &&
      incoming.isActive === false
    ) {
      throw new ApiError(422, 'INACTIVE_DEFAULT_PICK', 'Inactive packaging level cannot be the default pick UOM.');
    }
    if ('code' in incoming && incoming.code !== undefined && others.some((l) => l.code === incoming.code)) {
      throw new ApiError(409, 'DUPLICATE_CODE', `Packaging level code "${incoming.code}" already exists for this product.`);
    }
  }

  return {
    findCatalog: (args) => repo.findCatalog(args),
    searchActive: (query, limit) => repo.searchActive(query, limit),
    listActive: (limit) => repo.listActive(limit),
    findById: (productId) => repo.findById(productId),

    async findUnitProfile(productId) {
      await assertProductExists(productId);
      return repo.findUnitProfile(productId);
    },

    async upsertUnitProfile(productId, data) {
      await assertProductExists(productId);
      return repo.upsertUnitProfile(productId, data);
    },

    async findPackagingLevels(productId) {
      await assertProductExists(productId);
      return repo.findPackagingLevels(productId);
    },

    async setPackagingLevels(productId, levels) {
      await assertProductExists(productId);
      // Fast-rejection layer: surface validation errors before the DB round-trip.
      assertFinalPackagingState(levels);
      // Delegates to the SQL RPC which re-validates + replaces atomically.
      return repo.replaceAllPackagingLevels(productId, levels);
    },

    async createPackagingLevel(productId, data) {
      await assertProductExists(productId);
      const existing = await repo.findPackagingLevels(productId);
      validateSingleWrite(data, existing);
      return repo.createPackagingLevel(productId, data);
    },

    async updatePackagingLevel(productId, levelId, data) {
      await assertProductExists(productId);
      await assertLevelExists(productId, levelId);
      const existing = await repo.findPackagingLevels(productId);
      validateSingleWrite(data, existing, levelId);

      if (data.isBase === false) {
        const level = existing.find((l) => l.id === levelId);
        if (level?.isBase && !existing.find((l) => l.id !== levelId && l.isBase)) {
          throw new ApiError(
            422,
            'ZERO_BASE_ROWS',
            'Cannot remove base flag from the only base level. Assign another level as base first.'
          );
        }
      }

      const updated = await repo.updatePackagingLevel(productId, levelId, data);
      const afterOp = existing.map((l) => (l.id === levelId ? updated : l));
      assertBaseRowPreserved(afterOp);
      return updated;
    },

    async deletePackagingLevel(productId, levelId) {
      await assertProductExists(productId);
      await assertLevelExists(productId, levelId);
      const existing = await repo.findPackagingLevels(productId);
      assertBaseRowPreserved(existing.filter((l) => l.id !== levelId));
      return repo.deletePackagingLevel(productId, levelId);
    }
  };
}

/** Production factory — builds the repo from a Supabase client. */
export function createProductsService(supabase: SupabaseClient): ProductsService {
  return createProductsServiceFromRepo(createProductsRepo(supabase));
}
