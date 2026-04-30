import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../../errors.js';
import { mapSupabaseError } from '../../errors.js';
import {
  idResponseSchema,
  productCatalogResponseSchema,
  productResponseSchema,
  productsResponseSchema,
  productUnitProfileResponseSchema,
  productPackagingLevelsResponseSchema,
  productPackagingLevelResponseSchema,
  upsertUnitProfileBodySchema,
  createPackagingLevelBodySchema,
  patchPackagingLevelBodySchema,
  setPackagingLevelsBodySchema
} from '../../schemas.js';
import type { AuthenticatedRequestContext } from '../../auth.js';
import type { ProductsService } from './service.js';
import { parseOrThrow } from '../../validation.js';

type GetAuthContext = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<AuthenticatedRequestContext | null>;

type GetProductsService = (context: AuthenticatedRequestContext) => ProductsService;

function parseProductId(request: FastifyRequest): string {
  return parseOrThrow(idResponseSchema, {
    id: (request.params as { productId: string }).productId
  }).id;
}

function parseLevelId(request: FastifyRequest): string {
  return parseOrThrow(idResponseSchema, {
    id: (request.params as { levelId: string }).levelId
  }).id;
}

export function registerProductsRoutes(
  app: FastifyInstance,
  deps: {
    getAuthContext: GetAuthContext;
    getProductsService: GetProductsService;
  }
): void {
  const { getAuthContext, getProductsService } = deps;

  // ── Catalog ──────────────────────────────────────────────────────────────

  app.get('/api/products', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const queryParams = z
      .object({
        query: z.string().trim().optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        offset: z.coerce.number().int().min(0).optional(),
        activeOnly: z
          .union([z.literal('true'), z.literal('false')])
          .optional()
      })
      .parse(request.query);

    const catalog = await getProductsService(auth).findCatalog({
      query: queryParams.query ?? '',
      limit: queryParams.limit ?? 50,
      offset: queryParams.offset ?? 0,
      activeOnly: queryParams.activeOnly === 'true'
    });

    return parseOrThrow(productCatalogResponseSchema, catalog);
  });

  app.get('/api/products/search', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const queryParams = z
      .object({
        query: z.string().trim().optional()
      })
      .parse(request.query);

    const service = getProductsService(auth);
    const products =
      queryParams.query && queryParams.query.trim().length > 0
        ? await service.searchActive(queryParams.query)
        : await service.listActive();

    return parseOrThrow(productsResponseSchema, products);
  });

  app.get('/api/products/:productId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const productId = parseProductId(request);
    const product = await getProductsService(auth).findById(productId);

    if (!product) {
      throw new ApiError(404, 'NOT_FOUND', 'Product was not found.');
    }

    return parseOrThrow(productResponseSchema, product);
  });

  // ── Unit Profile ─────────────────────────────────────────────────────────

  app.get('/api/products/:productId/unit-profile', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const productId = parseProductId(request);
    const profile = await getProductsService(auth).findUnitProfile(productId);

    if (!profile) {
      return reply.code(204).send();
    }

    return parseOrThrow(productUnitProfileResponseSchema, profile);
  });

  app.put('/api/products/:productId/unit-profile', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const productId = parseProductId(request);
    const body = parseOrThrow(upsertUnitProfileBodySchema, request.body);

    try {
      const profile = await getProductsService(auth).upsertUnitProfile(productId, body);
      return parseOrThrow(productUnitProfileResponseSchema, profile);
    } catch (err) {
      const mapped = mapSupabaseError(err);
      if (mapped) throw mapped;
      throw err;
    }
  });

  // ── Packaging Levels ─────────────────────────────────────────────────────

  app.get('/api/products/:productId/packaging-levels', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const productId = parseProductId(request);
    const levels = await getProductsService(auth).findPackagingLevels(productId);
    return parseOrThrow(productPackagingLevelsResponseSchema, levels);
  });

  // Atomic replace of the entire set — validates final state before writing.
  app.put('/api/products/:productId/packaging-levels', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const productId = parseProductId(request);
    const body = parseOrThrow(setPackagingLevelsBodySchema, request.body);

    try {
      const levels = await getProductsService(auth).setPackagingLevels(
        productId,
        body.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          baseUnitQty: item.baseUnitQty,
          isBase: item.isBase,
          canPick: item.canPick,
          canStore: item.canStore,
          isDefaultPickUom: item.isDefaultPickUom,
          barcode: item.barcode ?? null,
          packWeightG: item.packWeightG ?? null,
          packWidthMm: item.packWidthMm ?? null,
          packHeightMm: item.packHeightMm ?? null,
          packDepthMm: item.packDepthMm ?? null,
          sortOrder: item.sortOrder,
          isActive: item.isActive
        }))
      );
      return parseOrThrow(productPackagingLevelsResponseSchema, levels);
    } catch (err) {
      const mapped = mapSupabaseError(err);
      if (mapped) throw mapped;
      throw err;
    }
  });

  app.post('/api/products/:productId/packaging-levels', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const productId = parseProductId(request);
    const body = parseOrThrow(createPackagingLevelBodySchema, request.body);

    try {
      const level = await getProductsService(auth).createPackagingLevel(productId, {
        code: body.code,
        name: body.name,
        baseUnitQty: body.baseUnitQty,
        isBase: body.isBase,
        canPick: body.canPick,
        canStore: body.canStore,
        isDefaultPickUom: body.isDefaultPickUom,
        barcode: body.barcode ?? null,
        packWeightG: body.packWeightG ?? null,
        packWidthMm: body.packWidthMm ?? null,
        packHeightMm: body.packHeightMm ?? null,
        packDepthMm: body.packDepthMm ?? null,
        sortOrder: body.sortOrder,
        isActive: body.isActive
      });
      return reply.code(201).send(parseOrThrow(productPackagingLevelResponseSchema, level));
    } catch (err) {
      const mapped = mapSupabaseError(err);
      if (mapped) throw mapped;
      throw err;
    }
  });

  app.patch('/api/products/:productId/packaging-levels/:levelId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const productId = parseProductId(request);
    const levelId = parseLevelId(request);
    const body = parseOrThrow(patchPackagingLevelBodySchema, request.body);

    try {
      const level = await getProductsService(auth).updatePackagingLevel(productId, levelId, {
        ...(body.code !== undefined && { code: body.code }),
        ...(body.name !== undefined && { name: body.name }),
        ...(body.baseUnitQty !== undefined && { baseUnitQty: body.baseUnitQty }),
        ...(body.isBase !== undefined && { isBase: body.isBase }),
        ...(body.canPick !== undefined && { canPick: body.canPick }),
        ...(body.canStore !== undefined && { canStore: body.canStore }),
        ...(body.isDefaultPickUom !== undefined && { isDefaultPickUom: body.isDefaultPickUom }),
        ...('barcode' in body && { barcode: body.barcode }),
        ...('packWeightG' in body && { packWeightG: body.packWeightG }),
        ...('packWidthMm' in body && { packWidthMm: body.packWidthMm }),
        ...('packHeightMm' in body && { packHeightMm: body.packHeightMm }),
        ...('packDepthMm' in body && { packDepthMm: body.packDepthMm }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
        ...(body.isActive !== undefined && { isActive: body.isActive })
      });
      return parseOrThrow(productPackagingLevelResponseSchema, level);
    } catch (err) {
      const mapped = mapSupabaseError(err);
      if (mapped) throw mapped;
      throw err;
    }
  });

  app.delete('/api/products/:productId/packaging-levels/:levelId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const productId = parseProductId(request);
    const levelId = parseLevelId(request);

    try {
      await getProductsService(auth).deletePackagingLevel(productId, levelId);
      return reply.code(204).send();
    } catch (err) {
      const mapped = mapSupabaseError(err);
      if (mapped) throw mapped;
      throw err;
    }
  });
}
