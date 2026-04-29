import type { FastifyInstance } from 'fastify';
import { ApiError } from '../errors.js';
import { createLocationReadRepo } from '../features/location-read/location-read-repo.js';
import {
  attachProductsToRows,
  type ProductAwareRow
} from '../inventory-product-resolution.js';
import {
  mapContainerStorageSnapshotRowToDomain
} from '../mappers.js';
import type { RouteDeps } from '../route-deps.js';
import {
  containerCurrentLocationResponseSchema,
  containerResponseSchema,
  containerStorageSnapshotResponseSchema,
  containerTypesResponseSchema,
  containersResponseSchema,
  idResponseSchema,
  listContainersQuerySchema
} from '../schemas.js';

type ContainerReadRouteDeps = Pick<RouteDeps, 'getAuthContext' | 'getContainersService' | 'getUserSupabase'>;

function parseOrThrow<T>(schema: { parse: (input: unknown) => T }, payload: unknown): T {
  return schema.parse(payload);
}

export function registerContainerReadRoutes(app: FastifyInstance, deps: ContainerReadRouteDeps): void {
  app.get('/api/container-types', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const types = await deps.getContainersService(auth).listAllTypes();
    return parseOrThrow(containerTypesResponseSchema, types);
  });

  app.get('/api/containers', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const query = parseOrThrow(listContainersQuerySchema, request.query);
    const containers = await deps.getContainersService(auth).listAll(
      query.operationalRole !== undefined ? { operationalRole: query.operationalRole } : undefined
    );
    return parseOrThrow(containersResponseSchema, containers);
  });

  app.get('/api/containers/:containerId/storage', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const supabase = deps.getUserSupabase(auth);
    const { data, error } = await supabase
      .from('container_storage_canonical_v')
      .select('tenant_id,container_id,system_code,external_code,container_type,container_status,inventory_unit_id,item_ref,product_id,quantity,uom,packaging_state,product_packaging_level_id,pack_count,container_packaging_profile_id,container_is_standard_pack,preferred_packaging_profile_id,preset_usage_status,preset_materialization_status')
      .eq('container_id', containerId);

    if (error) {
      throw error;
    }

    const rows = await attachProductsToRows(supabase, (data ?? []) as Array<ProductAwareRow & {
      tenant_id: string;
      container_id: string;
      system_code: string;
      external_code: string | null;
      container_type: string;
      container_status: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
      inventory_unit_id?: string | null;
      product_id?: string | null;
      quantity: number | null;
      uom: string | null;
      packaging_state?: 'sealed' | 'opened' | 'loose' | null;
      product_packaging_level_id?: string | null;
      pack_count?: number | null;
      container_packaging_profile_id?: string | null;
      container_is_standard_pack?: boolean | null;
      preferred_packaging_profile_id?: string | null;
      preset_usage_status?: 'preferred_match' | 'standard_non_preferred' | 'manual' | 'unknown' | null;
      preset_materialization_status?: 'shell' | 'materialized' | 'manual' | 'unknown' | null;
    }>);

    return parseOrThrow(containerStorageSnapshotResponseSchema, rows.map(mapContainerStorageSnapshotRowToDomain));
  });

  app.get('/api/containers/:containerId', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const container = await deps.getContainersService(auth).findById(containerId);

    if (!container) {
      throw new ApiError(404, 'NOT_FOUND', 'Container was not found.');
    }

    return parseOrThrow(containerResponseSchema, container);
  });

  app.get('/api/containers/:containerId/location', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const supabase = deps.getUserSupabase(auth);
    const locationReadRepo = createLocationReadRepo(supabase);
    const currentLocation = await locationReadRepo.getContainerCurrentLocation(containerId);

    if (!currentLocation) {
      if (!(await locationReadRepo.containerExists(containerId))) {
        throw new ApiError(404, 'CONTAINER_NOT_FOUND', 'Container was not found.');
      }

      return parseOrThrow(containerCurrentLocationResponseSchema, {
        containerId,
        currentLocationId: null,
        locationCode: null,
        locationType: null,
        cellId: null
      });
    }

    return parseOrThrow(containerCurrentLocationResponseSchema, currentLocation);
  });
}
