import type { FastifyInstance } from 'fastify';

export type RouteRegistrar = (app: FastifyInstance) => void;

export function registerRoutes(_app: FastifyInstance): void {
  // TODO(PR-02+): compose feature route registrars here.
}
