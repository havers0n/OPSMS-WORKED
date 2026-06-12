import type { FastifyInstance } from 'fastify';
import { createLayoutRepo } from './repo.js';
import type { RouteDeps } from '../../route-deps.js';
import {
  cellsResponseSchema,
  createLayoutDraftBodySchema,
  idResponseSchema,
  layoutDraftResponseSchema,
  persistedDraftValidationResponseSchema,
  publishLayoutDraftBodySchema,
  publishResponseSchema,
  publishedLayoutSummaryResponseSchema,
  saveLayoutDraftBodySchema,
  saveLayoutDraftResponseSchema
} from '../../schemas.js';
import { mapPersistedDraftValidationResult } from '../../mappers.js';
import { parseOrThrow } from '../../validation.js';

type LayoutRouteDeps = Pick<RouteDeps, 'getAuthContext' | 'getUserSupabase' | 'getLayoutService'>;

export function registerLayoutRoutes(app: FastifyInstance, deps: LayoutRouteDeps): void {
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

  app.post('/api/layout-drafts', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const body = parseOrThrow(createLayoutDraftBodySchema, request.body);
    const layoutService = deps.getLayoutService(auth);
    const id = await layoutService.createDraft(body.floorId, auth.user.id);

    return parseOrThrow(idResponseSchema, { id });
  });

  app.post('/api/layout-drafts/save', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const body = parseOrThrow(saveLayoutDraftBodySchema, request.body);
    const layoutService = deps.getLayoutService(auth);
    const result = await layoutService.saveDraft(body.layoutDraft, auth.user.id);

    return parseOrThrow(saveLayoutDraftResponseSchema, result);
  });

  app.post('/api/layout-drafts/:layoutVersionId/validate', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const layoutVersionId = parseOrThrow(idResponseSchema, { id: (request.params as { layoutVersionId: string }).layoutVersionId }).id;
    const layoutService = deps.getLayoutService(auth);
    const result = await layoutService.validateVersion(layoutVersionId);

    return parseOrThrow(
      persistedDraftValidationResponseSchema,
      mapPersistedDraftValidationResult(result)
    );
  });

  app.post('/api/layout-drafts/:layoutVersionId/publish', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const layoutVersionId = parseOrThrow(idResponseSchema, { id: (request.params as { layoutVersionId: string }).layoutVersionId }).id;
    const body = parseOrThrow(publishLayoutDraftBodySchema, request.body);
    const layoutService = deps.getLayoutService(auth);
    const result = await layoutService.publishDraft(
      layoutVersionId,
      body.expectedDraftVersion,
      auth.user.id,
      body.renameMappings ?? []
    );

    return parseOrThrow(publishResponseSchema, result);
  });
}
