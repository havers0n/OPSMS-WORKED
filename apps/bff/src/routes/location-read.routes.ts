import type { FastifyInstance } from 'fastify';
import { ApiError } from '../errors.js';
import { createLocationReadRepo } from '../features/location-read/location-read-repo.js';
import {
  attachProductsToRows,
  type ProductAwareRow
} from '../inventory-product-resolution.js';
import {
  mapLocationOccupancyRowToDomain,
  mapLocationStorageSnapshotRowToDomain
} from '../mappers.js';
import type { RouteDeps } from '../route-deps.js';
import {
  idResponseSchema,
  locationOccupancyRowsResponseSchema,
  locationReferenceResponseSchema,
  locationStorageSnapshotRowsResponseSchema,
  nonRackLocationsResponseSchema,
  patchLocationGeometryBodySchema
} from '../schemas.js';

type LocationReadRouteDeps = Pick<RouteDeps, 'getAuthContext' | 'getUserSupabase'>;

function parseOrThrow<T>(schema: { parse: (input: unknown) => T }, payload: unknown): T {
  return schema.parse(payload);
}

export function registerLocationReadRoutes(app: FastifyInstance, deps: LocationReadRouteDeps): void {
  app.get('/api/locations/:locationId/containers', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const locationId = parseOrThrow(idResponseSchema, {
      id: (request.params as { locationId: string }).locationId
    }).id;
    const supabase = deps.getUserSupabase(auth);
    const locationReadRepo = createLocationReadRepo(supabase);

    if (!(await locationReadRepo.locationExists(locationId))) {
      throw new ApiError(404, 'LOCATION_NOT_FOUND', 'Location was not found.');
    }

    const rows = await locationReadRepo.listLocationContainers(locationId);
    return parseOrThrow(locationOccupancyRowsResponseSchema, rows.map(mapLocationOccupancyRowToDomain));
  });

  app.get('/api/locations/:locationId/storage', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const locationId = parseOrThrow(idResponseSchema, {
      id: (request.params as { locationId: string }).locationId
    }).id;
    const supabase = deps.getUserSupabase(auth);
    const locationReadRepo = createLocationReadRepo(supabase);

    if (!(await locationReadRepo.locationExists(locationId))) {
      throw new ApiError(404, 'LOCATION_NOT_FOUND', 'Location was not found.');
    }

    const data = await locationReadRepo.listLocationStorage(locationId);
    const rows = await attachProductsToRows(supabase, (data ?? []) as Array<ProductAwareRow & {
      tenant_id: string;
      floor_id: string;
      location_id: string;
      location_code: string;
      location_type: 'rack_slot' | 'floor' | 'staging' | 'dock' | 'buffer';
      cell_id: string | null;
      container_id: string;
      system_code: string;
      external_code: string | null;
      container_type: string;
      container_status: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
      placed_at: string;
      inventory_unit_id?: string | null;
      product_id?: string | null;
      quantity: number | null;
      uom: string | null;
    }>);

    return parseOrThrow(locationStorageSnapshotRowsResponseSchema, rows.map(mapLocationStorageSnapshotRowToDomain));
  });

  app.get('/api/locations/by-cell/:cellId', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const cellId = parseOrThrow(idResponseSchema, { id: (request.params as { cellId: string }).cellId }).id;
    const supabase = deps.getUserSupabase(auth);
    const locationReadRepo = createLocationReadRepo(supabase);
    const ref = await locationReadRepo.getLocationByCell(cellId);

    if (!ref) {
      throw new ApiError(404, 'LOCATION_NOT_FOUND', 'No active location found for this cell.');
    }

    return parseOrThrow(locationReferenceResponseSchema, ref);
  });

  app.get('/api/floors/:floorId/location-occupancy', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const floorId = parseOrThrow(idResponseSchema, {
      id: (request.params as { floorId: string }).floorId
    }).id;
    const supabase = deps.getUserSupabase(auth);
    const locationReadRepo = createLocationReadRepo(supabase);
    const rows = await locationReadRepo.listFloorLocationOccupancy(floorId);

    return parseOrThrow(locationOccupancyRowsResponseSchema, rows.map(mapLocationOccupancyRowToDomain));
  });

  app.get('/api/floors/:floorId/non-rack-locations', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const floorId = parseOrThrow(idResponseSchema, {
      id: (request.params as { floorId: string }).floorId
    }).id;
    const supabase = deps.getUserSupabase(auth);
    const locationReadRepo = createLocationReadRepo(supabase);
    const rows = await locationReadRepo.listFloorNonRackLocations(floorId);

    return parseOrThrow(
      nonRackLocationsResponseSchema,
      rows.map((row) => ({
        id: row.id,
        code: row.code,
        locationType: row.location_type,
        floorX: row.floor_x,
        floorY: row.floor_y,
        status: row.status
      }))
    );
  });

  app.patch('/api/locations/:locationId/geometry', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const locationId = parseOrThrow(idResponseSchema, {
      id: (request.params as { locationId: string }).locationId
    }).id;
    const body = parseOrThrow(patchLocationGeometryBodySchema, request.body);
    const supabase = deps.getUserSupabase(auth);
    const locationReadRepo = createLocationReadRepo(supabase);
    const row = await locationReadRepo.updateLocationGeometry(locationId, body.floorX, body.floorY);

    if (!row) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: 'Location not found or is a rack slot' });
    }

    return {
      id: row.id,
      code: row.code,
      locationType: row.location_type,
      floorX: row.floor_x,
      floorY: row.floor_y,
      status: row.status
    };
  });
}
