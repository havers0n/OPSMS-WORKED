import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedRequestContext } from '../../auth.js';
import { parseOrThrow } from '../../validation.js';
import {
  createDeliveryPointAliasMatchingService,
  deliveryPointAliasMatchRequestSchema,
  deliveryPointAliasMatchResponseSchema
} from './delivery-point-matching-service.js';

type GetAuthContext = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<AuthenticatedRequestContext | null>;

type GetUserSupabase = (context: AuthenticatedRequestContext) => SupabaseClient;

export function registerDeliveryPointsRoutes(
  app: FastifyInstance,
  deps: {
    getAuthContext: GetAuthContext;
    getUserSupabase: GetUserSupabase;
  }
): void {
  app.post('/api/delivery-points/match-aliases', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const body = parseOrThrow(deliveryPointAliasMatchRequestSchema, request.body);

    const service = createDeliveryPointAliasMatchingService(deps.getUserSupabase(auth));
    const results = await service.matchAliasesExact(body.aliases);

    return parseOrThrow(deliveryPointAliasMatchResponseSchema, { results });
  });
}
