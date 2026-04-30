import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ApiError } from '../../errors.js';
import type { AuthenticatedRequestContext } from '../../auth.js';
import {
  attachWaveOrderBodySchema,
  createWaveBodySchema,
  idResponseSchema,
  transitionWaveStatusBodySchema,
  waveResponseSchema,
  wavesResponseSchema
} from '../../schemas.js';
import { waveNotFound } from './errors.js';
import { createWavesRepo } from './repo.js';
import type { WavesService } from './service.js';
import { parseOrThrow } from '../../validation.js';

type GetAuthContext = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<AuthenticatedRequestContext | null>;

type GetUserSupabase = (context: AuthenticatedRequestContext) => SupabaseClient;
type GetWavesService = (context: AuthenticatedRequestContext) => WavesService;

export function registerWavesRoutes(
  app: FastifyInstance,
  deps: {
    getAuthContext: GetAuthContext;
    getUserSupabase: GetUserSupabase;
    getWavesService: GetWavesService;
  }
): void {
  const { getAuthContext, getUserSupabase, getWavesService } = deps;

  app.get('/api/waves', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    if (!auth.currentTenant) {
      throw new ApiError(403, 'NO_TENANT', 'No tenant context.');
    }

    const tenantId = auth.currentTenant.tenantId;
    const wavesRepo = createWavesRepo(getUserSupabase(auth));
    const waves = await wavesRepo.listWaveSummaries(tenantId);

    return parseOrThrow(wavesResponseSchema, waves);
  });

  app.post('/api/waves', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    if (!auth.currentTenant) {
      throw new ApiError(403, 'NO_TENANT', 'No tenant context.');
    }

    const tenantId = auth.currentTenant.tenantId;
    const body = parseOrThrow(createWaveBodySchema, request.body);
    const wave = await getWavesService(auth).createWave({
      tenantId,
      name: body.name
    });

    return parseOrThrow(waveResponseSchema, wave);
  });

  app.get('/api/waves/:waveId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const waveId = parseOrThrow(idResponseSchema, { id: (request.params as { waveId: string }).waveId }).id;
    const wavesRepo = createWavesRepo(getUserSupabase(auth));
    const wave = await wavesRepo.findWaveResponse(waveId);

    if (!wave) {
      throw waveNotFound(waveId);
    }

    return parseOrThrow(waveResponseSchema, wave);
  });

  app.patch('/api/waves/:waveId/status', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const waveId = parseOrThrow(idResponseSchema, { id: (request.params as { waveId: string }).waveId }).id;
    const body = parseOrThrow(transitionWaveStatusBodySchema, request.body);
    const wave = await getWavesService(auth).transitionWaveStatus({
      waveId,
      status: body.status
    });

    return parseOrThrow(waveResponseSchema, wave);
  });

  app.post('/api/waves/:waveId/orders', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const waveId = parseOrThrow(idResponseSchema, { id: (request.params as { waveId: string }).waveId }).id;
    const body = parseOrThrow(attachWaveOrderBodySchema, request.body);
    const wave = await getWavesService(auth).attachOrderToWave({
      waveId,
      orderId: body.orderId
    });

    return parseOrThrow(waveResponseSchema, wave);
  });

  app.delete('/api/waves/:waveId/orders/:orderId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const params = request.params as { waveId: string; orderId: string };
    const waveId = parseOrThrow(idResponseSchema, { id: params.waveId }).id;
    const orderId = parseOrThrow(idResponseSchema, { id: params.orderId }).id;
    const wave = await getWavesService(auth).detachOrderFromWave({
      waveId,
      orderId
    });

    return parseOrThrow(waveResponseSchema, wave);
  });
}
