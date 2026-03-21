import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../../errors.js';
import {
  idResponseSchema,
  productCatalogResponseSchema,
  productResponseSchema,
  productsResponseSchema
} from '../../schemas.js';
import type { AuthenticatedRequestContext } from '../../auth.js';
import type { ProductsService } from './service.js';

type GetAuthContext = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<AuthenticatedRequestContext | null>;

type GetProductsService = (context: AuthenticatedRequestContext) => ProductsService;

function parseOrThrow<T>(schema: { parse: (input: unknown) => T }, payload: unknown): T {
  return schema.parse(payload);
}

export function registerProductsRoutes(
  app: FastifyInstance,
  deps: {
    getAuthContext: GetAuthContext;
    getProductsService: GetProductsService;
  }
): void {
  const { getAuthContext, getProductsService } = deps;

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

    const productId = parseOrThrow(idResponseSchema, {
      id: (request.params as { productId: string }).productId
    }).id;

    const product = await getProductsService(auth).findById(productId);

    if (!product) {
      throw new ApiError(404, 'NOT_FOUND', 'Product was not found.');
    }

    return parseOrThrow(productResponseSchema, product);
  });
}
