import * as XLSX from 'xlsx';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { BondedSnapshotDraft, BondedSnapshotDraftRow, BondedSnapshotDiagnostics } from '@wos/domain';
import { parseBondedWorkbook } from './bonded-excel-parser.js';
import { ApiError, sendApiError } from '../../errors.js';
import type { AuthenticatedRequestContext } from '../../auth.js';
import type { BondedService } from './bonded-service.js';

type GetAuthContext = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<AuthenticatedRequestContext | null>;

type GetBondedService = (context: AuthenticatedRequestContext) => BondedService;

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

function detectPivotSheet(buffer: Buffer): boolean {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellFormula: false, cellText: false, raw: true, sheets: [] });
    const PIVOT_SHEET_NAME = 'PIVOT!';
    return workbook.SheetNames.some(name => name.trim() === PIVOT_SHEET_NAME);
  } catch {
    return false;
  }
}

export function registerBondedRoutes(
  app: FastifyInstance,
  deps: {
    getAuthContext: GetAuthContext;
    getBondedService: GetBondedService;
  }
) {
  const { getAuthContext, getBondedService } = deps;

  app.post('/api/bonded/upload', async (request, reply) => {
    try {
      const auth = await getAuthContext(request, reply);
      if (!auth) return;
      const _tenantId = requireTenant(auth);

      const { fileName, buffer } = await readUploadFile(request);

      const pivotSheetFound = detectPivotSheet(buffer);
      const draft = parseBondedWorkbook({ fileName, buffer, logger: request.log });

      return {
        draft,
        fileName,
        pivotSheetFound
      };
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

  app.post('/api/bonded/snapshots', async (request, reply) => {
    try {
      const auth = await getAuthContext(request, reply);
      if (!auth) return;
      const tenantId = requireTenant(auth);

      const body = request.body as Record<string, unknown>;
      const planningDate = body.planningDate as string | undefined;
      if (!planningDate || !/^\d{4}-\d{2}-\d{2}$/.test(planningDate)) {
        throw new ApiError(400, 'INVALID_DATE', 'planningDate must be in YYYY-MM-DD format.');
      }

      const draft = body.draft as BondedSnapshotDraft | undefined;
      if (!draft || !draft.rows || !Array.isArray(draft.rows)) {
        throw new ApiError(400, 'INVALID_PREVIEW_PAYLOAD', 'Preview draft data is required and must be valid.');
      }

      const service = getBondedService(auth);
      const userId = auth.user?.id ?? null;

      const result = await service.createSnapshot(tenantId, userId, {
        planningDate,
        fileName: (body.fileName as string) ?? null,
        shiftId: (body.shiftId as string) ?? null,
        draft
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

  app.get('/api/bonded/snapshots', async (request, reply) => {
    try {
      const auth = await getAuthContext(request, reply);
      if (!auth) return;
      const tenantId = requireTenant(auth);

      const service = getBondedService(auth);
      const snapshots = await service.listSnapshots(tenantId);

      return snapshots;
    } catch (error) {
      if (error instanceof ApiError) {
        return sendApiError(reply, error, request.id);
      }
      return sendApiError(reply, new ApiError(500, 'INTERNAL_ERROR', 'Unexpected error'), request.id);
    }
  });

  app.get('/api/bonded/snapshots/:snapshotId', async (request, reply) => {
    try {
      const auth = await getAuthContext(request, reply);
      if (!auth) return;
      const tenantId = requireTenant(auth);

      const snapshotId = (request.params as { snapshotId: string }).snapshotId;
      const service = getBondedService(auth);
      const record = await service.getSnapshot(tenantId, snapshotId);

      if (!record) {
        throw new ApiError(404, 'NOT_FOUND', 'Bonded snapshot not found.');
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
