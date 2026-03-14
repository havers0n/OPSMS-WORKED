import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { ZodError, z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlacementCommandResponse } from '@wos/domain';
import { env } from './env.js';
import { ApiError, mapSupabaseError, sendApiError } from './errors.js';
import {
  cellsResponseSchema,
  cellStorageSnapshotResponseSchema,
  cellSlotStorageResponseSchema,
  cellOccupancyResponseSchema,
  containerResponseSchema,
  containerStorageSnapshotResponseSchema,
  containersResponseSchema,
  createInventoryItemBodySchema,
  createContainerResponseSchema,
  containerTypesResponseSchema,
  createContainerBodySchema,
  createFloorBodySchema,
  createLayoutDraftBodySchema,
  moveContainerBodySchema,
  moveContainerResponseSchema,
  placementCommandResponse,
  placementMoveBodySchema,
  placementPlaceBodySchema,
  placementRemoveBodySchema,
  placeContainerBodySchema,
  placeContainerResponseSchema,
  createSiteBodySchema,
  currentWorkspaceResponseSchema,
  floorWorkspaceResponseSchema,
  floorsResponseSchema,
  idResponseSchema,
  inventoryItemResponseSchema,
  inventoryItemsResponseSchema,
  layoutDraftResponseSchema,
  layoutVersionIdResponseSchema,
  publishResponseSchema,
  publishedLayoutSummaryResponseSchema,
  removeContainerResponseSchema,
  saveLayoutDraftBodySchema,
  sitesResponseSchema,
  validationResponseSchema
} from './schemas.js';
import { getUserClient, requireAuth, type AuthenticatedRequestContext } from './auth.js';
import {
  mapCellOccupancyRowToDomain,
  mapCellRowToDomain,
  mapCellStorageSnapshotRowToDomain,
  mapContainerRowToDomain,
  mapContainerStorageSnapshotRowToDomain,
  mapContainerTypeRowToDomain,
  mapFloorRowToDomain,
  mapInventoryItemRowToDomain,
  mapLayoutDraftBundleToDomain,
  mapSiteRowToDomain,
  mapValidationResult
} from './mappers.js';
import { createAnonClient } from './supabase.js';
import {
  ActivePlacementNotFoundError,
  ContainerAlreadyPlacedError,
  ContainerNotFoundError,
  CrossFloorPlacementMoveNotAllowedError,
  PlacementSourceMismatchError,
  PublishedLayoutNotFoundError,
  TargetCellNotFoundError,
  TargetCellSameAsSourceError
} from './features/placement/errors.js';
import {
  createPlacementCommandService,
  type PlacementCommandService
} from './features/placement/service.js';

type UserClientFactory = (context: AuthenticatedRequestContext) => SupabaseClient;
type PlacementServiceFactory = (context: AuthenticatedRequestContext) => PlacementCommandService;

type BuildAppOptions = {
  getAuthContext?: typeof requireAuth;
  getUserSupabase?: UserClientFactory;
  getHealthSupabase?: () => SupabaseClient;
  getPlacementService?: PlacementServiceFactory;
};

function parseOrThrow<T>(schema: { parse: (input: unknown) => T }, payload: unknown): T {
  return schema.parse(payload);
}

type LayoutVersionRow = {
  id: string;
  floor_id: string;
  version_no: number;
  state: 'draft' | 'published' | 'archived';
  published_at?: string | null;
};

async function fetchLatestLayoutVersionByState(
  supabase: SupabaseClient,
  floorId: string,
  state: LayoutVersionRow['state']
) {
  const { data: layoutVersions, error: layoutVersionsError } = await supabase
    .from('layout_versions')
    .select('id,floor_id,version_no,state,published_at')
    .eq('floor_id', floorId);

  if (layoutVersionsError) {
    throw layoutVersionsError;
  }

  return ((layoutVersions ?? []) as LayoutVersionRow[])
    .filter((row) => row.state === state)
    .sort((a, b) => b.version_no - a.version_no)[0];
}

async function fetchLayoutVersionBundle(
  supabase: SupabaseClient,
  layoutVersion: LayoutVersionRow | null
) {
  if (!layoutVersion) {
    return null;
  }

  const { data: racks, error: racksError } = await supabase
    .from('racks')
    .select('id,layout_version_id,display_code,kind,axis,x,y,total_length,depth,rotation_deg')
    .eq('layout_version_id', layoutVersion.id);

  if (racksError) {
    throw racksError;
  }

  if (!racks || racks.length === 0) {
    return {
      layoutVersionId: layoutVersion.id,
      floorId: layoutVersion.floor_id,
      state: layoutVersion.state,
      rackIds: [],
      racks: {}
    };
  }

  const rackIds = racks.map((rack) => rack.id);
  const { data: rackFaces, error: rackFacesError } = await supabase
    .from('rack_faces')
    .select('id,rack_id,side,enabled,slot_numbering_direction,is_mirrored,mirror_source_face_id,face_length')
    .in('rack_id', rackIds);

  if (rackFacesError) {
    throw rackFacesError;
  }

  const faceIds = (rackFaces ?? []).map((face) => face.id);
  const { data: rackSections, error: rackSectionsError } =
    faceIds.length > 0
      ? await supabase.from('rack_sections').select('id,rack_face_id,ordinal,length').in('rack_face_id', faceIds)
      : { data: [], error: null };

  if (rackSectionsError) {
    throw rackSectionsError;
  }

  const sectionIds = (rackSections ?? []).map((section) => section.id);
  const { data: rackLevels, error: rackLevelsError } =
    sectionIds.length > 0
      ? await supabase.from('rack_levels').select('id,rack_section_id,ordinal,slot_count').in('rack_section_id', sectionIds)
      : { data: [], error: null };

  if (rackLevelsError) {
    throw rackLevelsError;
  }

  return mapLayoutDraftBundleToDomain({
    layoutVersion,
    racks,
    rackFaces: rackFaces ?? [],
    rackSections: rackSections ?? [],
    rackLevels: rackLevels ?? []
  });
}

async function fetchActiveLayoutDraft(supabase: SupabaseClient, floorId: string) {
  const activeDraft = await fetchLatestLayoutVersionByState(supabase, floorId, 'draft');
  return fetchLayoutVersionBundle(supabase, activeDraft);
}

async function fetchLatestPublishedLayout(supabase: SupabaseClient, floorId: string) {
  const latestPublished = await fetchLatestLayoutVersionByState(supabase, floorId, 'published');
  return fetchLayoutVersionBundle(supabase, latestPublished);
}

async function fetchPublishedLayoutSummary(supabase: SupabaseClient, floorId: string) {
  const publishedVersion = await fetchLatestLayoutVersionByState(supabase, floorId, 'published');
  if (!publishedVersion) {
    return null;
  }

  const { data: sampleCells, count, error: sampleCellsError } = await supabase
    .from('cells')
    .select('address,address_sort_key', { count: 'exact' })
    .eq('layout_version_id', publishedVersion.id)
    .order('address_sort_key', { ascending: true })
    .limit(4);

  if (sampleCellsError) {
    throw sampleCellsError;
  }

  return {
    layoutVersionId: publishedVersion.id,
    floorId: publishedVersion.floor_id,
    versionNo: publishedVersion.version_no,
    publishedAt: publishedVersion.published_at ?? new Date(0).toISOString(),
    cellCount: count ?? sampleCells?.length ?? 0,
    sampleAddresses: (sampleCells ?? []).map((cell) => cell.address)
  };
}

function mapPlacementError(error: unknown): ApiError | null {
  if (error instanceof ContainerNotFoundError) {
    return new ApiError(404, 'CONTAINER_NOT_FOUND', error.message);
  }

  if (error instanceof TargetCellNotFoundError) {
    return new ApiError(404, 'TARGET_CELL_NOT_FOUND', error.message);
  }

  if (error instanceof ContainerAlreadyPlacedError) {
    return new ApiError(409, 'CONTAINER_ALREADY_PLACED', error.message);
  }

  if (error instanceof PublishedLayoutNotFoundError) {
    return new ApiError(409, 'PUBLISHED_LAYOUT_NOT_FOUND', error.message);
  }

  if (error instanceof ActivePlacementNotFoundError) {
    return new ApiError(409, 'ACTIVE_PLACEMENT_NOT_FOUND', error.message);
  }

  if (error instanceof PlacementSourceMismatchError) {
    return new ApiError(409, 'PLACEMENT_SOURCE_MISMATCH', error.message);
  }

  if (error instanceof TargetCellSameAsSourceError) {
    return new ApiError(409, 'TARGET_CELL_SAME_AS_SOURCE', error.message);
  }

  if (error instanceof CrossFloorPlacementMoveNotAllowedError) {
    return new ApiError(409, 'CROSS_FLOOR_MOVE_NOT_ALLOWED', error.message);
  }

  return null;
}

function isContainerTypeConstraintError(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  const details = 'details' in error && typeof error.details === 'string' ? error.details : '';
  const constraint = 'constraint' in error && typeof error.constraint === 'string' ? error.constraint : '';

  return [message, details, constraint].some((value) =>
    value.includes('container_type') || value.includes('containers_container_type_id_fkey')
  );
}

async function containerTypeExists(supabase: SupabaseClient, containerTypeId: string) {
  const { data, error } = await supabase
    .from('container_types')
    .select('id')
    .eq('id', containerTypeId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function containerCodeExists(supabase: SupabaseClient, tenantId: string, externalCode: string) {
  const { data, error } = await supabase
    .from('containers')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('external_code', externalCode)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: {
      level: env.logLevel,
      base: {
        service: env.serviceName
      },
      redact: {
        paths: ['req.headers.authorization'],
        censor: '[REDACTED]'
      }
    }
  });

  const getAuthContext = options.getAuthContext ?? requireAuth;
  const getUserSupabase = options.getUserSupabase ?? getUserClient;
  const getHealthSupabase = options.getHealthSupabase ?? createAnonClient;
  const getPlacementService =
    options.getPlacementService ??
    ((context: AuthenticatedRequestContext) => createPlacementCommandService(getUserSupabase(context)));

  void app.register(cors, {
    origin: env.corsOrigin,
    credentials: true
  });

  app.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        route: request.routeOptions.url,
        method: request.method,
        statusCode: reply.statusCode,
        responseTimeMs: reply.elapsedTime
      },
      'request completed'
    );
  });

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

  app.get('/ready', async (_request, reply) => {
    const supabase = getHealthSupabase();
    const { error } = await supabase.from('sites').select('id').limit(1);

    if (error) {
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

  app.get('/api/sites', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase.from('sites').select('id,code,name,timezone').order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return parseOrThrow(sitesResponseSchema, (data ?? []).map(mapSiteRowToDomain));
  });

  app.get('/api/container-types', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('container_types')
      .select('id,code,description')
      .order('code', { ascending: true });

    if (error) {
      throw error;
    }

    return parseOrThrow(containerTypesResponseSchema, (data ?? []).map(mapContainerTypeRowToDomain));
  });

  app.get('/api/containers', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('containers')
      .select('id,tenant_id,external_code,container_type_id,status,created_at,created_by')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return parseOrThrow(containersResponseSchema, (data ?? []).map(mapContainerRowToDomain));
  });

  app.get('/api/cells/:cellId/containers', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const cellId = parseOrThrow(idResponseSchema, { id: (request.params as { cellId: string }).cellId }).id;
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('cell_occupancy_v')
      .select('tenant_id,cell_id,container_id,external_code,container_type,container_status,placed_at')
      .eq('cell_id', cellId)
      .order('placed_at', { ascending: true });

    if (error) {
      throw error;
    }

    return parseOrThrow(cellOccupancyResponseSchema, (data ?? []).map(mapCellOccupancyRowToDomain));
  });

  app.get('/api/cells/:cellId/storage', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const cellId = parseOrThrow(idResponseSchema, { id: (request.params as { cellId: string }).cellId }).id;
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('cell_storage_snapshot_v')
      .select('tenant_id,cell_id,container_id,external_code,container_type,container_status,placed_at,item_ref,quantity,uom')
      .eq('cell_id', cellId)
      .order('placed_at', { ascending: true });

    if (error) {
      throw error;
    }

    return parseOrThrow(cellStorageSnapshotResponseSchema, (data ?? []).map(mapCellStorageSnapshotRowToDomain));
  });

  app.get('/api/floors/:floorId/published-cells', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const floorId = parseOrThrow(idResponseSchema, {
      id: (request.params as { floorId: string }).floorId
    }).id;
    const supabase = getUserSupabase(auth);
    const publishedVersion = await fetchLatestLayoutVersionByState(supabase, floorId, 'published');

    if (!publishedVersion) {
      return parseOrThrow(cellsResponseSchema, []);
    }

    const { data, error } = await supabase
      .from('cells')
      .select('id,layout_version_id,rack_id,rack_face_id,rack_section_id,rack_level_id,slot_no,address,address_sort_key,cell_code,x,y,status')
      .eq('layout_version_id', publishedVersion.id)
      .order('address_sort_key', { ascending: true });

    if (error) {
      throw error;
    }

    return parseOrThrow(cellsResponseSchema, (data ?? []).map(mapCellRowToDomain));
  });

  /**
   * GET /api/rack-sections/:sectionId/slots/:slotNo/storage
   *
   * Returns cell storage snapshot rows for all cells in a given rack section slot.
   * This endpoint exists because the web has no direct DB access — it needs a
   * structural lookup path (sectionId + slotNo) rather than a persisted cell UUID.
   *
   * Cells only exist for published layout versions. If the layout has not been
   * published, the cells table will be empty for the section and an empty array
   * is returned (not an error — the inspector UI handles this state).
   */
  app.get('/api/rack-sections/:sectionId/slots/:slotNo/storage', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const params = request.params as { sectionId: string; slotNo: string };
    const rawSectionId = params.sectionId.trim();
    const slotNo = z.coerce.number().int().min(1).parse(params.slotNo);

    // Non-UUID section IDs come from in-memory sections that have never been
    // published. No persisted cells can exist for them — return the
    // "unpublished" response immediately without touching the DB.
    const sectionIdParsed = z.string().uuid().safeParse(rawSectionId);
    if (!sectionIdParsed.success) {
      return parseOrThrow(cellSlotStorageResponseSchema, { published: false, rows: [] });
    }
    const sectionId = sectionIdParsed.data;

    const supabase = getUserSupabase(auth);

    // Step 1: resolve persisted cell UUIDs for this section + slot.
    // A slot position spans one cell per level (e.g., 3 levels → 3 cells).
    const { data: cells, error: cellsError } = await supabase
      .from('cells')
      .select('id')
      .eq('rack_section_id', sectionId)
      .eq('slot_no', slotNo);

    if (cellsError) {
      throw cellsError;
    }

    const cellIds = (cells ?? []).map((c) => c.id);

    // Layout not yet published — no persisted cell UUIDs exist for this slot.
    if (cellIds.length === 0) {
      return parseOrThrow(cellSlotStorageResponseSchema, { published: false, rows: [] });
    }

    // Step 2: fetch storage snapshot for all cells in this slot.
    const { data, error } = await supabase
      .from('cell_storage_snapshot_v')
      .select('tenant_id,cell_id,container_id,external_code,container_type,container_status,placed_at,item_ref,quantity,uom')
      .in('cell_id', cellIds)
      .order('placed_at', { ascending: true });

    if (error) {
      throw error;
    }

    return parseOrThrow(cellSlotStorageResponseSchema, {
      published: true,
      rows: (data ?? []).map(mapCellStorageSnapshotRowToDomain)
    });
  });

  app.get('/api/containers/:containerId/inventory', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('inventory_items')
      .select('id,tenant_id,container_id,item_ref,quantity,uom,created_at,created_by')
      .eq('container_id', containerId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return parseOrThrow(inventoryItemsResponseSchema, (data ?? []).map(mapInventoryItemRowToDomain));
  });

  app.get('/api/containers/:containerId/storage', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('container_storage_snapshot_v')
      .select('tenant_id,container_id,external_code,container_type,container_status,item_ref,quantity,uom')
      .eq('container_id', containerId);

    if (error) {
      throw error;
    }

    return parseOrThrow(containerStorageSnapshotResponseSchema, (data ?? []).map(mapContainerStorageSnapshotRowToDomain));
  });

  app.get('/api/me', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    return parseOrThrow(currentWorkspaceResponseSchema, {
      user: {
        id: auth.user.id,
        email: auth.user.email ?? 'unknown@local.invalid',
        displayName: auth.displayName
      },
      currentTenantId: auth.currentTenant?.tenantId ?? null,
      memberships: auth.memberships
    });
  });

  app.post('/api/sites', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const body = parseOrThrow(createSiteBodySchema, request.body);
    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace is available for site creation.');
    }

    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('sites')
      .insert({ tenant_id: auth.currentTenant.tenantId, code: body.code, name: body.name, timezone: body.timezone })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return parseOrThrow(idResponseSchema, { id: data.id });
  });

  app.post('/api/containers', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const body = parseOrThrow(createContainerBodySchema, request.body);
    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace is available for container creation.');
    }

    const supabase = getUserSupabase(auth);
    const typeExists = await containerTypeExists(supabase, body.containerTypeId);
    if (!typeExists) {
      throw new ApiError(400, 'INVALID_CONTAINER_TYPE', 'Container type was not found.');
    }

    const externalCodeExists = await containerCodeExists(
      supabase,
      auth.currentTenant.tenantId,
      body.externalCode
    );
    if (externalCodeExists) {
      throw new ApiError(409, 'CONTAINER_CODE_ALREADY_EXISTS', 'Container code already exists in this workspace.');
    }

    const { data, error } = await supabase
      .from('containers')
      .insert({
        tenant_id: auth.currentTenant.tenantId,
        container_type_id: body.containerTypeId,
        external_code: body.externalCode,
        created_by: auth.user.id
      })
      .select('id,tenant_id,external_code,container_type_id,status,created_at,created_by')
      .single();

    if (error) {
      if ('code' in error && error.code === '23505') {
        throw new ApiError(409, 'CONTAINER_CODE_ALREADY_EXISTS', 'Container code already exists in this workspace.');
      }

      if ('code' in error && error.code === '23503' && isContainerTypeConstraintError(error)) {
        throw new ApiError(400, 'INVALID_CONTAINER_TYPE', 'Container type was not found.');
      }

      throw error;
    }

    return parseOrThrow(createContainerResponseSchema, {
      containerId: data.id,
      externalCode: data.external_code ?? '',
      containerTypeId: data.container_type_id,
      status: data.status
    });
  });

  app.get('/api/sites/:siteId/floors', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const siteId = parseOrThrow(idResponseSchema, { id: (request.params as { siteId: string }).siteId }).id;
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('floors')
      .select('id,site_id,code,name,sort_order')
      .eq('site_id', siteId)
      .order('sort_order', { ascending: true });

    if (error) {
      throw error;
    }

    return parseOrThrow(floorsResponseSchema, (data ?? []).map(mapFloorRowToDomain));
  });

  app.get('/api/containers/:containerId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('containers')
      .select('id,tenant_id,external_code,container_type_id,status,created_at,created_by')
      .eq('id', containerId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new ApiError(404, 'NOT_FOUND', 'Container was not found.');
    }

    return parseOrThrow(containerResponseSchema, mapContainerRowToDomain(data));
  });

  app.post('/api/containers/:containerId/place', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const body = parseOrThrow(placeContainerBodySchema, request.body);
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase.rpc('place_container', {
      container_uuid: containerId,
      cell_uuid: body.cellId,
      actor_uuid: auth.user.id
    });

    if (error) {
      throw error;
    }

    return parseOrThrow(placeContainerResponseSchema, data);
  });

  app.post('/api/containers/:containerId/remove', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase.rpc('remove_container', {
      container_uuid: containerId,
      actor_uuid: auth.user.id
    });

    if (error) {
      throw error;
    }

    return parseOrThrow(removeContainerResponseSchema, data);
  });

  app.post('/api/placement/place', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace is available for placement writes.');
    }

    const body = parseOrThrow(placementPlaceBodySchema, request.body);
    const service = getPlacementService(auth);

    try {
      const result: PlacementCommandResponse = await service.placeContainer({
        tenantId: auth.currentTenant.tenantId,
        containerId: body.containerId,
        targetCellId: body.targetCellId,
        actorId: auth.user.id
      });

      return parseOrThrow(placementCommandResponse, result);
    } catch (error) {
      const apiError = mapPlacementError(error);
      if (apiError) {
        throw apiError;
      }

      throw error;
    }
  });

  app.post('/api/placement/remove', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace is available for placement writes.');
    }

    const body = parseOrThrow(placementRemoveBodySchema, request.body);
    const service = getPlacementService(auth);

    try {
      const result: PlacementCommandResponse = await service.removeContainer({
        tenantId: auth.currentTenant.tenantId,
        containerId: body.containerId,
        fromCellId: body.fromCellId,
        actorId: auth.user.id
      });

      return parseOrThrow(placementCommandResponse, result);
    } catch (error) {
      const apiError = mapPlacementError(error);
      if (apiError) {
        throw apiError;
      }

      throw error;
    }
  });

  app.post('/api/placement/move', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace is available for placement writes.');
    }

    const body = parseOrThrow(placementMoveBodySchema, request.body);
    const service = getPlacementService(auth);

    try {
      const result: PlacementCommandResponse = await service.moveContainer({
        tenantId: auth.currentTenant.tenantId,
        containerId: body.containerId,
        fromCellId: body.fromCellId,
        toCellId: body.toCellId,
        actorId: auth.user.id
      });

      return parseOrThrow(placementCommandResponse, result);
    } catch (error) {
      const apiError = mapPlacementError(error);
      if (apiError) {
        throw apiError;
      }

      throw error;
    }
  });

  app.post('/api/containers/:containerId/move', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const body = parseOrThrow(moveContainerBodySchema, request.body);
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase.rpc('move_container', {
      container_uuid: containerId,
      target_cell_uuid: body.targetCellId,
      actor_uuid: auth.user.id
    });

    if (error) {
      throw error;
    }

    return parseOrThrow(moveContainerResponseSchema, data);
  });

  app.post('/api/containers/:containerId/inventory', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const body = parseOrThrow(createInventoryItemBodySchema, request.body);
    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace is available for inventory writes.');
    }
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        tenant_id: auth.currentTenant.tenantId,
        container_id: containerId,
        item_ref: body.itemRef,
        quantity: body.quantity,
        uom: body.uom,
        created_by: auth.user.id
      })
      .select('id,tenant_id,container_id,item_ref,quantity,uom,created_at,created_by')
      .single();

    if (error) {
      throw error;
    }

    return parseOrThrow(inventoryItemResponseSchema, mapInventoryItemRowToDomain(data));
  });

  app.post('/api/floors', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const body = parseOrThrow(createFloorBodySchema, request.body);
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('floors')
      .insert({
        site_id: body.siteId,
        code: body.code,
        name: body.name,
        sort_order: body.sortOrder
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return parseOrThrow(idResponseSchema, { id: data.id });
  });

  app.get('/api/floors/:floorId/layout-draft', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const floorId = parseOrThrow(idResponseSchema, { id: (request.params as { floorId: string }).floorId }).id;
    const supabase = getUserSupabase(auth);
    const draft = await fetchActiveLayoutDraft(supabase, floorId);
    return parseOrThrow(layoutDraftResponseSchema, draft);
  });

  app.get('/api/floors/:floorId/workspace', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const floorId = parseOrThrow(idResponseSchema, { id: (request.params as { floorId: string }).floorId }).id;
    const supabase = getUserSupabase(auth);
    const [activeDraft, latestPublished] = await Promise.all([
      fetchActiveLayoutDraft(supabase, floorId),
      fetchLatestPublishedLayout(supabase, floorId)
    ]);

    return parseOrThrow(floorWorkspaceResponseSchema, {
      floorId,
      activeDraft,
      latestPublished
    });
  });

  app.get('/api/floors/:floorId/published-layout', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const floorId = parseOrThrow(idResponseSchema, { id: (request.params as { floorId: string }).floorId }).id;
    const supabase = getUserSupabase(auth);
    const summary = await fetchPublishedLayoutSummary(supabase, floorId);
    return parseOrThrow(publishedLayoutSummaryResponseSchema, summary);
  });

  app.post('/api/layout-drafts', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const body = parseOrThrow(createLayoutDraftBodySchema, request.body);
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase.rpc('create_layout_draft', {
      floor_uuid: body.floorId,
      actor_uuid: auth.user.id
    });

    if (error) {
      throw error;
    }

    return parseOrThrow(idResponseSchema, { id: data });
  });

  app.post('/api/layout-drafts/save', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const body = parseOrThrow(saveLayoutDraftBodySchema, request.body);
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase.rpc('save_layout_draft', {
      layout_payload: body.layoutDraft,
      actor_uuid: auth.user.id
    });

    if (error) {
      throw error;
    }

    return parseOrThrow(layoutVersionIdResponseSchema, { layoutVersionId: data });
  });

  app.post('/api/layout-drafts/:layoutVersionId/validate', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const layoutVersionId = parseOrThrow(idResponseSchema, { id: (request.params as { layoutVersionId: string }).layoutVersionId }).id;
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase.rpc('validate_layout_version', {
      layout_version_uuid: layoutVersionId
    });

    if (error) {
      throw error;
    }

    return parseOrThrow(validationResponseSchema, mapValidationResult(data ?? { isValid: false, issues: [] }));
  });

  app.post('/api/layout-drafts/:layoutVersionId/publish', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const layoutVersionId = parseOrThrow(idResponseSchema, { id: (request.params as { layoutVersionId: string }).layoutVersionId }).id;
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase.rpc('publish_layout_version', {
      layout_version_uuid: layoutVersionId,
      actor_uuid: auth.user.id
    });

    if (error) {
      throw error;
    }

    return parseOrThrow(publishResponseSchema, data);
  });

  app.setErrorHandler((error, request, reply) => {
    const mappedSupabaseError = mapSupabaseError(error);

    const apiError =
      error instanceof ZodError
        ? new ApiError(400, 'VALIDATION_ERROR', error.issues.map((issue) => issue.message).join('; '))
        : error instanceof ApiError
        ? error
        : mappedSupabaseError
        ? mappedSupabaseError
        : new ApiError(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Unexpected BFF error');

    request.log.error(
      {
        err: error,
        requestId: request.id,
        route: request.routeOptions.url,
        statusCode: apiError.statusCode,
        errorCode: apiError.code
      },
      'request failed'
    );

    void sendApiError(reply, apiError, request.id);
  });

  return app;
}
