import type { FastifyInstance } from 'fastify';
import {
  clientErrorReportRequestBodySchema,
  clientErrorReportResponseSchema
} from '../schemas.js';
import { parseOrThrow } from '../validation.js';

export function registerClientErrorsRoutes(app: FastifyInstance): void {
  app.post('/api/client-errors', async (request, reply) => {
    const body = parseOrThrow(clientErrorReportRequestBodySchema, request.body);

    request.log.error(
      {
        clientErrorId: body.clientErrorId,
        source: body.source,
        route: body.route,
        message: body.message,
        stack: body.stack,
        componentStack: body.componentStack,
        context: body.context,
        url: body.url,
        viewport: body.viewport,
        reportedUserAgent: body.userAgent,
        requestUserAgent: request.headers['user-agent'],
        forwardedFor: request.headers['x-forwarded-for']
      },
      'client runtime error reported'
    );

    return reply.code(202).send(
      parseOrThrow(clientErrorReportResponseSchema, {
        accepted: true,
        requestId: request.id
      })
    );
  });
}
