import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../env.js';
import { ApiError } from '../errors.js';

import type { RouteDeps } from '../route-deps.js';
import { parseOrThrow } from '../validation.js';

type HealthRouteDeps = Pick<RouteDeps, 'getHealthSupabase'>;

export function registerHealthRoutes(app: FastifyInstance, deps: HealthRouteDeps): void {
  app.get('/health', async () =>
    parseOrThrow(
      z.object({
        status: z.literal('ok'),
        service: z.string(),
        time: z.string()
      }),
      {
        status: 'ok',
        service: env.serviceName,
        time: new Date().toISOString()
      }
    )
  );

  app.get('/ready', async () => {
    const supabase = deps.getHealthSupabase();
    const { data, error } = await supabase.rpc('healthcheck');

    if (error || data !== 'ok') {
      throw new ApiError(503, 'BFF_NOT_READY', 'Supabase connectivity check failed.');
    }

    return parseOrThrow(
      z.object({
        status: z.literal('ready'),
        service: z.string(),
        checks: z.object({
          supabase: z.literal('ok')
        })
      }),
      {
        status: 'ready',
        service: env.serviceName,
        checks: {
          supabase: 'ok'
        }
      }
    );
  });
}
