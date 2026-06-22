import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { WarehouseStockSnapshotPreview } from '@wos/domain';
import { parseWarehouseStockWorkbook } from './warehouse-stock-excel-parser.js';
import { ApiError, sendApiError } from '../../errors.js';
import type { AuthenticatedRequestContext } from '../../auth.js';
import type { WarehouseStockService } from './warehouse-stock-service.js';

type GetAuthContext = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<AuthenticatedRequestContext | null>;

type GetWarehouseStockService = (context: AuthenticatedRequestContext) => WarehouseStockService;

function requireTenant(auth: AuthenticatedRequestContext) {
  if (!auth.currentTenant) {
    throw new ApiError(403, 'NO_TENANT', 'No tenant context.');
  }
  return auth.currentTenant.tenantId;
}

function mapMultipartError(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  const code = (error as { code?: string }).code;
  switch (code) {
    case 'FST_REQ_FILE_TOO_LARGE':
      return new ApiError(413, 'FILE_TOO_LARGE', 'Uploaded file exceeds the 20MB limit.');
    case 'FST_FILES_LIMIT':
    case 'FST_FIELDS_LIMIT':
    case 'FST_PARTS_LIMIT':
      return new ApiError(400, 'UNSUPPORTED_FILE_TYPE', 'Multipart upload contains unexpected parts.');
    case 'FST_INVALID_MULTIPART_CONTENT_TYPE':
      return new ApiError(400, 'INVALID_MULTIPART_REQUEST', 'Request must use multipart/form-data.');
    default:
      return null;
  }
}

async function readUploadFile(request: FastifyRequest) {
  const multipartRequest = request as FastifyRequest & {
    file: () => Promise<{
      filename?: string;
      mimetype?: string;
      toBuffer: () => Promise<Buffer>;
    } | undefined>;
  };

  const file = await multipartRequest.file();
  if (!file || !file.filename) {
    throw new ApiError(400, 'MISSING_FILE', 'Multipart file field "file" is required.');
  }

  const buffer = await file.toBuffer();
  let fileName = file.filename;
  if (!fileName.toLowerCase().endsWith('.xlsx')) {
    throw new ApiError(400, 'UNSUPPORTED_FILE_TYPE', 'Only .xlsx files are supported.');
  }

  return { fileName, buffer };
}

export function registerWarehouseStockRoutes(
  app: FastifyInstance,
  deps: {
    getAuthContext: GetAuthContext;
    getWarehouseStockService: GetWarehouseStockService;
  }
) {
  const { getAuthContext, getWarehouseStockService } = deps;

  app.post('/api/warehouse-stock/upload', async (request, reply) => {
    try {
      const auth = await getAuthContext(request, reply);
      if (!auth) return;
      requireTenant(auth);

      const { fileName, buffer } = await readUploadFile(request);
      const result = parseWarehouseStockWorkbook({ fileName, buffer, logger: request.log });

      return result;
    } catch (error) {
      const apiError = (() => {
        const mapped = mapMultipartError(error);
        if (mapped) return mapped;
        if (error instanceof ApiError) return error;
        return new ApiError(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Unexpected error');
      })();
      return sendApiError(reply, apiError, request.id);
    }
  });

  app.post('/api/warehouse-stock/snapshots', async (request, reply) => {
    try {
      const auth = await getAuthContext(request, reply);
      if (!auth) return;
      const tenantId = requireTenant(auth);

      const body = request.body as Record<string, unknown>;
      const planningDate = body.planningDate as string | undefined;
      if (!planningDate || !/^\d{4}-\d{2}-\d{2}$/.test(planningDate)) {
        throw new ApiError(400, 'INVALID_DATE', 'planningDate must be in YYYY-MM-DD format.');
      }

      const preview = body.preview as WarehouseStockSnapshotPreview | undefined;
      if (!preview || !preview.rows || !Array.isArray(preview.rows)) {
        throw new ApiError(400, 'INVALID_PREVIEW_PAYLOAD', 'Preview data is required and must be valid.');
      }

      const service = getWarehouseStockService(auth);
      const userId = auth.user?.id ?? null;

      const result = await service.createSnapshot(tenantId, userId, {
        planningDate,
        fileName: (body.fileName as string) ?? null,
        shiftId: (body.shiftId as string) ?? null,
        preview
      });

      void reply.code(201);
      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        return sendApiError(reply, error, request.id);
      }
      return sendApiError(reply, new ApiError(500, 'INTERNAL_ERROR', 'Unexpected error'), request.id);
    }
  });

  app.get('/api/warehouse-stock/snapshots', async (request, reply) => {
    try {
      const auth = await getAuthContext(request, reply);
      if (!auth) return;
      const tenantId = requireTenant(auth);

      const service = getWarehouseStockService(auth);
      const snapshots = await service.listSnapshots(tenantId);

      return snapshots;
    } catch (error) {
      if (error instanceof ApiError) {
        return sendApiError(reply, error, request.id);
      }
      return sendApiError(reply, new ApiError(500, 'INTERNAL_ERROR', 'Unexpected error'), request.id);
    }
  });

  app.get('/api/warehouse-stock/snapshots/:snapshotId', async (request, reply) => {
    try {
      const auth = await getAuthContext(request, reply);
      if (!auth) return;
      const tenantId = requireTenant(auth);

      const snapshotId = (request.params as { snapshotId: string }).snapshotId;
      const service = getWarehouseStockService(auth);
      const record = await service.getSnapshot(tenantId, snapshotId);

      if (!record) {
        throw new ApiError(404, 'NOT_FOUND', 'Warehouse stock snapshot not found.');
      }

      return record;
    } catch (error) {
      if (error instanceof ApiError) {
        return sendApiError(reply, error, request.id);
      }
      return sendApiError(reply, new ApiError(500, 'INTERNAL_ERROR', 'Unexpected error'), request.id);
    }
  });
}
