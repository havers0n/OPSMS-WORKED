import type { FastifyInstance } from 'fastify';
import { createLayoutRepo } from '../features/layout/repo.js';
import type { RouteDeps } from '../route-deps.js';
import { cellsResponseSchema, idResponseSchema, layoutDraftResponseSchema, publishedLayoutSummaryResponseSchema } from '../schemas.js';

type LayoutReadRouteDeps = Pick<RouteDeps, 'getAuthContext' | 'getUserSupabase'>;

function parseOrThrow<T>(schema: { parse: (input: unknown) => T }, payload: unknown): T {
  return schema.parse(payload);
}

export function registerLayoutReadRoutes(app: FastifyInstance, deps: LayoutReadRouteDeps): void {
  app.get('/api/floors/:floorId/published-cells', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const floorId = parseOrThrow(idResponseSchema, {
      id: (request.params as { floorId: string }).floorId
    }).id;
    const supabase = deps.getUserSupabase(auth);
    const layoutRepo = createLayoutRepo(supabase);
    const cells = await layoutRepo.listPublishedCells(floorId);

    return parseOrThrow(cellsResponseSchema, cells);
  });

  app.get('/api/floors/:floorId/layout-draft', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const floorId = parseOrThrow(idResponseSchema, { id: (request.params as { floorId: string }).floorId }).id;
    const supabase = deps.getUserSupabase(auth);
    const layoutRepo = createLayoutRepo(supabase);
    const draft = await layoutRepo.findActiveDraft(floorId);
    return parseOrThrow(layoutDraftResponseSchema, draft);
  });

  app.get('/api/floors/:floorId/published-layout', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const floorId = parseOrThrow(idResponseSchema, { id: (request.params as { floorId: string }).floorId }).id;
    const supabase = deps.getUserSupabase(auth);
    const layoutRepo = createLayoutRepo(supabase);
    const summary = await layoutRepo.findPublishedLayoutSummary(floorId);
    return parseOrThrow(publishedLayoutSummaryResponseSchema, summary);
  });
}
