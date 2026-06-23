import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import type { AuthenticatedRequestContext } from '../../auth.js';
import type { BondedCoverageService } from './bonded-coverage-service.js';
import {
  createBondedCoverageRequestInputSchema,
  addBondedCoverageRequestItemInputSchema,
  updateBondedCoverageRequestItemInputSchema,
  closeBondedCoverageRequestInputSchema,
  cancelBondedCoverageRequestInputSchema,
  listBondedCoverageRequestsInputSchema
} from '@wos/domain';
import { ApiError, sendApiError } from '../../errors.js';

type GetAuthContext = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<AuthenticatedRequestContext | null>;

type GetBondedCoverageService = (context: AuthenticatedRequestContext) => BondedCoverageService;

function requireTenant(auth: AuthenticatedRequestContext) {
  if (!auth.currentTenant) {
    throw new ApiError(403, 'NO_TENANT', 'No tenant context.');
  }
  return auth.currentTenant.tenantId;
}

function getActorInfo(auth: AuthenticatedRequestContext) {
  return {
    userId: auth.user?.id ?? null,
    userName: auth.displayName || auth.user?.email || null
  };
}

function isApiErrorLike(error: unknown): error is { statusCode: number; code: string; message: string } {
  return typeof error === 'object' && error !== null && 'statusCode' in error && 'code' in error;
}

function handleRouteError(error: unknown, reply: FastifyReply, requestId: string) {
  if (error instanceof ApiError || isApiErrorLike(error)) {
    return sendApiError(reply, error instanceof ApiError ? error : new ApiError((error as any).statusCode, (error as any).code, (error as any).message), requestId);
  }
  if (error instanceof ZodError) {
    return sendApiError(reply, new ApiError(400, 'VALIDATION_ERROR', error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')), requestId);
  }
  return sendApiError(reply, new ApiError(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Unexpected error'), requestId);
}

export function registerBondedCoverageRoutes(
  app: FastifyInstance,
  deps: {
    getAuthContext: GetAuthContext;
    getBondedCoverageService: GetBondedCoverageService;
  }
) {
  const { getAuthContext, getBondedCoverageService } = deps;

  // ── Create request ─────────────────────────────────────────────────────────

  app.post('/api/manual-shifts/:shiftId/bonded-requests', async (request, reply) => {
    try {
      const auth = await getAuthContext(request, reply);
      if (!auth) return;
      const tenantId = requireTenant(auth);
      const shiftId = (request.params as { shiftId: string }).shiftId;
      const { userId, userName } = getActorInfo(auth);

      const body = createBondedCoverageRequestInputSchema.parse(request.body);

      const service = getBondedCoverageService(auth);
      const result = await service.createRequest(tenantId, shiftId, userId, userName, body);

      void reply.code(201);
      return result;
    } catch (error) {
      return handleRouteError(error, reply, request.id);
    }
  });

  // ── List requests ──────────────────────────────────────────────────────────

  app.get('/api/manual-shifts/:shiftId/bonded-requests', async (request, reply) => {
    try {
      const auth = await getAuthContext(request, reply);
      if (!auth) return;
      const tenantId = requireTenant(auth);
      const shiftId = (request.params as { shiftId: string }).shiftId;

      const query = listBondedCoverageRequestsInputSchema.parse(request.query ?? {});

      const service = getBondedCoverageService(auth);
      const result = await service.listRequests(tenantId, shiftId, query.status);

      return result;
    } catch (error) {
      return handleRouteError(error, reply, request.id);
    }
  });

  // ── Get request detail ─────────────────────────────────────────────────────

  app.get('/api/bonded-requests/:requestId', async (request, reply) => {
    try {
      const auth = await getAuthContext(request, reply);
      if (!auth) return;
      const tenantId = requireTenant(auth);
      const requestId = (request.params as { requestId: string }).requestId;

      const service = getBondedCoverageService(auth);
      const result = await service.getRequest(tenantId, requestId);

      if (!result) {
        throw new ApiError(404, 'NOT_FOUND', 'Bonded coverage request not found.');
      }

      return result;
    } catch (error) {
      return handleRouteError(error, reply, request.id);
    }
  });

  // ── Add item ───────────────────────────────────────────────────────────────

  app.post('/api/bonded-requests/:requestId/items', async (request, reply) => {
    try {
      const auth = await getAuthContext(request, reply);
      if (!auth) return;
      const tenantId = requireTenant(auth);
      const requestId = (request.params as { requestId: string }).requestId;

      const body = addBondedCoverageRequestItemInputSchema.parse(request.body);

      const service = getBondedCoverageService(auth);
      const result = await service.addItem(tenantId, requestId, body);

      void reply.code(201);
      return result;
    } catch (error) {
      return handleRouteError(error, reply, request.id);
    }
  });

  // ── Update item ────────────────────────────────────────────────────────────

  app.patch('/api/bonded-requests/:requestId/items/:itemId', async (request, reply) => {
    try {
      const auth = await getAuthContext(request, reply);
      if (!auth) return;
      const tenantId = requireTenant(auth);
      const params = request.params as { requestId: string; itemId: string };

      const body = updateBondedCoverageRequestItemInputSchema.parse(request.body);

      const service = getBondedCoverageService(auth);
      const result = await service.updateItem(tenantId, params.requestId, params.itemId, body);

      return result;
    } catch (error) {
      return handleRouteError(error, reply, request.id);
    }
  });

  // ── Close request ──────────────────────────────────────────────────────────

  app.post('/api/bonded-requests/:requestId/close', async (request, reply) => {
    try {
      const auth = await getAuthContext(request, reply);
      if (!auth) return;
      const tenantId = requireTenant(auth);
      const requestId = (request.params as { requestId: string }).requestId;
      const { userId, userName } = getActorInfo(auth);

      const body = closeBondedCoverageRequestInputSchema.parse(request.body ?? {});

      const service = getBondedCoverageService(auth);
      const result = await service.closeRequest(tenantId, requestId, userId, userName, body);

      return result;
    } catch (error) {
      return handleRouteError(error, reply, request.id);
    }
  });

  // ── Cancel request ─────────────────────────────────────────────────────────

  app.post('/api/bonded-requests/:requestId/cancel', async (request, reply) => {
    try {
      const auth = await getAuthContext(request, reply);
      if (!auth) return;
      const tenantId = requireTenant(auth);
      const requestId = (request.params as { requestId: string }).requestId;
      const { userId, userName } = getActorInfo(auth);

      const body = cancelBondedCoverageRequestInputSchema.parse(request.body ?? {});

      const service = getBondedCoverageService(auth);
      const result = await service.cancelRequest(tenantId, requestId, userId, userName, body);

      return result;
    } catch (error) {
      return handleRouteError(error, reply, request.id);
    }
  });
}
