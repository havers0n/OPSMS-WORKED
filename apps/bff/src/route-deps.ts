import { requireAuth } from './auth.js';
import { getUserClient } from './auth.js';
import { createAnonClient } from './supabase.js';
import { createPlacementCommandService } from './features/placement/service.js';
import { createOrdersService } from './features/orders/service.js';
import { createWavesService } from './features/waves/service.js';
import { createInventoryService } from './features/inventory/service.js';
import { createLayoutService } from './features/layout/service.js';
import { createSitesService } from './features/sites/service.js';
import { createContainersService } from './features/containers/service.js';
import { createFloorsService } from './features/floors/service.js';
import { createProductsService } from './features/products/service.js';
import { createPickingService } from './features/picking/service.js';
import { createProductLocationRolesService } from './features/product-location-roles/service.js';
import { createStoragePresetsService } from './features/storage-presets/service.js';
import { createPickingPlanningPreviewService } from './features/picking-planning/service.js';
import { createPickingPlanningOrderInputReadRepo, createPickingPlanningWaveReadRepo } from './features/picking-planning/repo.js';
import type { BuildAppOptions } from './app-options.js';
import { ApiError } from './errors.js';

export type RouteDeps = Required<BuildAppOptions>;

export function createRouteDeps(options: BuildAppOptions = {}): RouteDeps {
  const getAuthContext = options.getAuthContext ?? requireAuth;
  const getUserSupabase = options.getUserSupabase ?? getUserClient;
  const getHealthSupabase = options.getHealthSupabase ?? createAnonClient;
  const getPlacementService =
    options.getPlacementService ?? ((context) => createPlacementCommandService(getUserSupabase(context)));
  const getOrdersService = options.getOrdersService ?? ((context) => createOrdersService(getUserSupabase(context)));
  const getWavesService = options.getWavesService ?? ((context) => createWavesService(getUserSupabase(context)));
  const getInventoryService =
    options.getInventoryService ?? ((context) => createInventoryService(getUserSupabase(context)));
  const getLayoutService = options.getLayoutService ?? ((context) => createLayoutService(getUserSupabase(context)));
  const getSitesService = options.getSitesService ?? ((context) => createSitesService(getUserSupabase(context)));
  const getContainersService =
    options.getContainersService ?? ((context) => createContainersService(getUserSupabase(context)));
  const getFloorsService = options.getFloorsService ?? ((context) => createFloorsService(getUserSupabase(context)));
  const getProductsService =
    options.getProductsService ?? ((context) => createProductsService(getUserSupabase(context)));
  const getPickingService = options.getPickingService ?? ((context) => createPickingService(getUserSupabase(context)));
  const getProductLocationRolesService =
    options.getProductLocationRolesService ??
    ((context) => createProductLocationRolesService(getUserSupabase(context)));
  const getStoragePresetsService =
    options.getStoragePresetsService ?? ((context) => createStoragePresetsService(getUserSupabase(context)));
  const getPickingPlanningPreviewService =
    options.getPickingPlanningPreviewService ??
    ((context) => {
      if (!context.currentTenant) {
        throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace is available for planning preview.');
      }

      return createPickingPlanningPreviewService(
        undefined,
        createPickingPlanningOrderInputReadRepo(getUserSupabase(context), context.currentTenant.tenantId),
        createPickingPlanningWaveReadRepo(getUserSupabase(context), context.currentTenant.tenantId)
      );
    });

  return {
    getAuthContext,
    getUserSupabase,
    getHealthSupabase,
    getPlacementService,
    getPickingService,
    getOrdersService,
    getWavesService,
    getInventoryService,
    getLayoutService,
    getSitesService,
    getContainersService,
    getFloorsService,
    getProductsService,
    getProductLocationRolesService,
    getStoragePresetsService,
    getPickingPlanningPreviewService
  };
}
