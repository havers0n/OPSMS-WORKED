import type { FastifyInstance } from 'fastify';
import { mapPersistedDraftValidationResult } from '../mappers.js';
import type { RouteDeps } from '../route-deps.js';
import {
  createLayoutDraftBodySchema,
  idResponseSchema,
  persistedDraftValidationResponseSchema,
  publishLayoutDraftBodySchema,
  publishResponseSchema,
  saveLayoutDraftBodySchema,
  saveLayoutDraftResponseSchema
} from '../schemas.js';

type LayoutMutationsRouteDeps = Pick<RouteDeps, 'getAuthContext' | 'getLayoutService'>;

function parseOrThrow<T>(schema: { parse: (input: unknown) => T }, payload: unknown): T {
  return schema.parse(payload);
}

export function registerLayoutMutationsRoutes(app: FastifyInstance, deps: LayoutMutationsRouteDeps): void {
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
    const result = await layoutService.publishDraft(layoutVersionId, body.expectedDraftVersion, auth.user.id);

    return parseOrThrow(publishResponseSchema, result);
  });
}
