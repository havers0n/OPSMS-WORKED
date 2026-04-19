import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createProductsServiceFromRepo } from './service.js';
import type { ProductsRepo } from './repo.js';
import type { Product, ProductPackagingLevel } from '@wos/domain';
import { ApiError } from '../../errors.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const productId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const levelId   = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const level2Id  = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const fakeProduct: Product = {
  id: productId,
  source: 'test',
  externalProductId: 'EXT-1',
  sku: 'SKU-1',
  name: 'Widget',
  permalink: null,
  imageUrls: [],
  imageFiles: [],
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

function makeLevel(overrides: Partial<ProductPackagingLevel> = {}): ProductPackagingLevel {
  return {
    id: levelId,
    productId,
    code: 'EACH',
    name: 'Each',
    baseUnitQty: 1,
    isBase: true,
    canPick: true,
    canStore: true,
    isDefaultPickUom: true,
    barcode: null,
    packWeightG: null,
    packWidthMm: null,
    packHeightMm: null,
    packDepthMm: null,
    sortOrder: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

const baseLevel   = makeLevel();
const cartonLevel = makeLevel({ id: level2Id, code: 'CTN', name: 'Carton', baseUnitQty: 12, isBase: false, isDefaultPickUom: false });

function makeRepo(overrides: Partial<ProductsRepo> = {}): ProductsRepo {
  return {
    findById:                 vi.fn().mockResolvedValue(fakeProduct),
    listActive:               vi.fn().mockResolvedValue([]),
    searchActive:             vi.fn().mockResolvedValue([]),
    findCatalog:              vi.fn().mockResolvedValue({ items: [], total: 0, activeTotal: 0, limit: 50, offset: 0 }),
    findUnitProfile:          vi.fn().mockResolvedValue(null),
    upsertUnitProfile:        vi.fn(),
    findPackagingLevels:      vi.fn().mockResolvedValue([baseLevel, cartonLevel]),
    createPackagingLevel:     vi.fn().mockResolvedValue(cartonLevel),
    updatePackagingLevel:     vi.fn().mockImplementation((_pid, _lid, data) =>
      Promise.resolve({ ...baseLevel, ...data })
    ),
    deletePackagingLevel:     vi.fn().mockResolvedValue(undefined),
    replaceAllPackagingLevels: vi.fn().mockResolvedValue([baseLevel]),
    ...overrides
  };
}

// ── setPackagingLevels — fast-rejection layer (service) ───────────────────────

describe('setPackagingLevels — service fast-rejection', () => {
  it('rejects an empty set without calling the repo', async () => {
    const repo = makeRepo();
    const service = createProductsServiceFromRepo(repo);

    await expect(service.setPackagingLevels(productId, [])).rejects.toThrow(ApiError);

    expect(repo.replaceAllPackagingLevels).not.toHaveBeenCalled();
  });

  it('rejects zero base rows without calling the repo', async () => {
    const repo = makeRepo();
    const service = createProductsServiceFromRepo(repo);

    const levels = [
      { code: 'CTN', name: 'Carton', baseUnitQty: 12, isBase: false, canPick: true, canStore: true, isDefaultPickUom: false, sortOrder: 0, isActive: true }
    ];

    await expect(service.setPackagingLevels(productId, levels)).rejects.toMatchObject({
      code: 'ZERO_BASE_ROWS',
      statusCode: 422
    });

    expect(repo.replaceAllPackagingLevels).not.toHaveBeenCalled();
  });

  it('rejects two base rows without calling the repo', async () => {
    const repo = makeRepo();
    const service = createProductsServiceFromRepo(repo);

    const levels = [
      { code: 'A', name: 'A', baseUnitQty: 1, isBase: true,  canPick: true, canStore: true, isDefaultPickUom: true,  sortOrder: 0, isActive: true },
      { code: 'B', name: 'B', baseUnitQty: 1, isBase: true,  canPick: true, canStore: true, isDefaultPickUom: false, sortOrder: 1, isActive: true }
    ];

    await expect(service.setPackagingLevels(productId, levels)).rejects.toMatchObject({
      code: 'MULTIPLE_BASE_ROWS'
    });

    expect(repo.replaceAllPackagingLevels).not.toHaveBeenCalled();
  });

  it('rejects two default pick rows without calling the repo', async () => {
    const repo = makeRepo();
    const service = createProductsServiceFromRepo(repo);

    const levels = [
      { code: 'EACH', name: 'Each', baseUnitQty: 1,  isBase: true,  canPick: true, canStore: true, isDefaultPickUom: true, sortOrder: 0, isActive: true },
      { code: 'CTN',  name: 'CTN',  baseUnitQty: 12, isBase: false, canPick: true, canStore: true, isDefaultPickUom: true, sortOrder: 1, isActive: true }
    ];

    await expect(service.setPackagingLevels(productId, levels)).rejects.toMatchObject({
      code: 'MULTIPLE_DEFAULT_PICK_ROWS'
    });

    expect(repo.replaceAllPackagingLevels).not.toHaveBeenCalled();
  });

  it('rejects base row with baseUnitQty != 1 without calling the repo', async () => {
    const repo = makeRepo();
    const service = createProductsServiceFromRepo(repo);

    const levels = [
      { code: 'EACH', name: 'Each', baseUnitQty: 3, isBase: true, canPick: true, canStore: true, isDefaultPickUom: true, sortOrder: 0, isActive: true }
    ];

    await expect(service.setPackagingLevels(productId, levels)).rejects.toMatchObject({
      code: 'BASE_UNIT_QTY_INVALID'
    });

    expect(repo.replaceAllPackagingLevels).not.toHaveBeenCalled();
  });

  it('calls replaceAllPackagingLevels when set is valid', async () => {
    const repo = makeRepo();
    const service = createProductsServiceFromRepo(repo);

    const levels = [
      { code: 'EACH', name: 'Each', baseUnitQty: 1, isBase: true, canPick: true, canStore: true, isDefaultPickUom: true, sortOrder: 0, isActive: true }
    ];

    await service.setPackagingLevels(productId, levels);

    expect(repo.replaceAllPackagingLevels).toHaveBeenCalledOnce();
    expect(repo.replaceAllPackagingLevels).toHaveBeenCalledWith(productId, levels);
  });

  it('propagates ApiErrors thrown by the repo (RPC mapped errors)', async () => {
    const rpcError = new ApiError(422, 'ZERO_BASE_ROWS', 'DB says no base rows');
    const repo = makeRepo({
      replaceAllPackagingLevels: vi.fn().mockRejectedValue(rpcError)
    });
    const service = createProductsServiceFromRepo(repo);

    const levels = [
      { code: 'EACH', name: 'Each', baseUnitQty: 1, isBase: true, canPick: true, canStore: true, isDefaultPickUom: true, sortOrder: 0, isActive: true }
    ];

    await expect(service.setPackagingLevels(productId, levels)).rejects.toBe(rpcError);
  });

  it('returns 404 for unknown product without calling the repo RPC', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = createProductsServiceFromRepo(repo);

    await expect(
      service.setPackagingLevels(productId, [
        { code: 'EACH', name: 'Each', baseUnitQty: 1, isBase: true, canPick: true, canStore: true, isDefaultPickUom: true, sortOrder: 0, isActive: true }
      ])
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });

    expect(repo.replaceAllPackagingLevels).not.toHaveBeenCalled();
  });
});

// ── deletePackagingLevel — base-row guard ─────────────────────────────────────

describe('deletePackagingLevel — base-row guard', () => {
  it('rejects deleting the only base level', async () => {
    // Repo has only one level (the base), so deleting it leaves no base rows.
    const repo = makeRepo({ findPackagingLevels: vi.fn().mockResolvedValue([baseLevel]) });
    const service = createProductsServiceFromRepo(repo);

    await expect(service.deletePackagingLevel(productId, levelId)).rejects.toMatchObject({
      code: 'ZERO_BASE_ROWS',
      statusCode: 422
    });

    expect(repo.deletePackagingLevel).not.toHaveBeenCalled();
  });

  it('allows deleting a non-base level when the base level remains', async () => {
    // Two levels: base + carton. Deleting the carton leaves the base intact.
    const repo = makeRepo({
      findPackagingLevels: vi.fn().mockResolvedValue([baseLevel, cartonLevel])
    });
    const service = createProductsServiceFromRepo(repo);

    await service.deletePackagingLevel(productId, level2Id);

    expect(repo.deletePackagingLevel).toHaveBeenCalledWith(productId, level2Id);
  });

  it('rejects deleting the only level in the set', async () => {
    const repo = makeRepo({ findPackagingLevels: vi.fn().mockResolvedValue([cartonLevel]) });
    const service = createProductsServiceFromRepo(repo);

    // Only the carton exists (non-base), and deleting it leaves an empty set.
    await expect(service.deletePackagingLevel(productId, level2Id)).rejects.toMatchObject({
      code: 'ZERO_BASE_ROWS'
    });
  });
});

// ── updatePackagingLevel — strip-base guard ───────────────────────────────────

describe('updatePackagingLevel — strip-base guard', () => {
  it('rejects setting isBase=false on the only base level', async () => {
    const repo = makeRepo({ findPackagingLevels: vi.fn().mockResolvedValue([baseLevel]) });
    const service = createProductsServiceFromRepo(repo);

    await expect(
      service.updatePackagingLevel(productId, levelId, { isBase: false })
    ).rejects.toMatchObject({ code: 'ZERO_BASE_ROWS', statusCode: 422 });

    expect(repo.updatePackagingLevel).not.toHaveBeenCalled();
  });

  it('allows setting isBase=false when another base level exists', async () => {
    const otherBase = makeLevel({ id: level2Id, code: 'BASE2', isBase: true });
    const repo = makeRepo({
      findPackagingLevels: vi.fn().mockResolvedValue([baseLevel, otherBase]),
      updatePackagingLevel: vi.fn().mockResolvedValue({ ...baseLevel, isBase: false })
    });
    const service = createProductsServiceFromRepo(repo);

    await service.updatePackagingLevel(productId, levelId, { isBase: false });

    expect(repo.updatePackagingLevel).toHaveBeenCalledOnce();
  });
});

// ── mapPackagingRpcError ──────────────────────────────────────────────────────

describe('mapPackagingRpcError', () => {
  it('maps all known RPC error codes to ApiError', async () => {
    const { mapPackagingRpcError } = await import('./errors.js');

    const cases: Array<[string, number, string]> = [
      ['PRODUCT_NOT_FOUND',        404, 'NOT_FOUND'],
      ['ZERO_BASE_ROWS',           422, 'ZERO_BASE_ROWS'],
      ['MULTIPLE_BASE_ROWS',       422, 'MULTIPLE_BASE_ROWS'],
      ['BASE_UNIT_QTY_INVALID',    422, 'BASE_UNIT_QTY_INVALID'],
      ['MULTIPLE_DEFAULT_PICK_ROWS', 422, 'MULTIPLE_DEFAULT_PICK_ROWS'],
      ['INACTIVE_DEFAULT_PICK',    422, 'INACTIVE_DEFAULT_PICK'],
      ['DUPLICATE_CODE',           409, 'DUPLICATE_CODE'],
      ['BASE_UNIT_QTY_BELOW_ONE',  422, 'BASE_UNIT_QTY_BELOW_ONE'],
      ['NON_POSITIVE_DIMENSION',   422, 'NON_POSITIVE_DIMENSION']
    ];

    for (const [msg, expectedStatus, expectedCode] of cases) {
      const result = mapPackagingRpcError({ message: msg });
      expect(result, `mapping for ${msg}`).toBeInstanceOf(ApiError);
      expect(result!.statusCode, `status for ${msg}`).toBe(expectedStatus);
      expect(result!.code, `code for ${msg}`).toBe(expectedCode);
    }
  });

  it('returns null for unrecognised error messages', async () => {
    const { mapPackagingRpcError } = await import('./errors.js');
    expect(mapPackagingRpcError({ message: 'SOME_OTHER_DB_ERROR' })).toBeNull();
    expect(mapPackagingRpcError(null)).toBeNull();
  });
});
