import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedRequestContext } from './auth.js';
import type { PlacementCommandService } from './features/placement/service.js';
import type { OrdersService } from './features/orders/service.js';
import type { WavesService } from './features/waves/service.js';
import type { InventoryService } from './features/inventory/service.js';
import type { LayoutService } from './features/layout/service.js';
import type { SitesService } from './features/sites/service.js';
import type { ContainersService } from './features/containers/service.js';
import type { FloorsService } from './features/floors/service.js';
import type { ProductsService } from './features/products/service.js';
import type { PickingService } from './features/picking/service.js';
import type { PickingPlanningPreviewService } from './features/picking-planning/service.js';
import type { ProductLocationRolesService } from './features/product-location-roles/service.js';
import type { StoragePresetsService } from './features/storage-presets/service.js';
import type { requireAuth } from './auth.js';

export type UserClientFactory = (context: AuthenticatedRequestContext) => SupabaseClient;
export type PlacementServiceFactory = (context: AuthenticatedRequestContext) => PlacementCommandService;
export type OrdersServiceFactory = (context: AuthenticatedRequestContext) => OrdersService;
export type WavesServiceFactory = (context: AuthenticatedRequestContext) => WavesService;
export type InventoryServiceFactory = (context: AuthenticatedRequestContext) => InventoryService;
export type LayoutServiceFactory = (context: AuthenticatedRequestContext) => LayoutService;
export type SitesServiceFactory = (context: AuthenticatedRequestContext) => SitesService;
export type ContainersServiceFactory = (context: AuthenticatedRequestContext) => ContainersService;
export type FloorsServiceFactory = (context: AuthenticatedRequestContext) => FloorsService;
export type ProductsServiceFactory = (context: AuthenticatedRequestContext) => ProductsService;
export type PickingServiceFactory = (context: AuthenticatedRequestContext) => PickingService;
export type PickingPlanningPreviewServiceFactory = (
  context: AuthenticatedRequestContext
) => PickingPlanningPreviewService;
export type ProductLocationRolesServiceFactory = (
  context: AuthenticatedRequestContext
) => ProductLocationRolesService;
export type StoragePresetsServiceFactory = (context: AuthenticatedRequestContext) => StoragePresetsService;

export type BuildAppOptions = {
  getAuthContext?: typeof requireAuth;
  getUserSupabase?: UserClientFactory;
  getHealthSupabase?: () => SupabaseClient;
  getPlacementService?: PlacementServiceFactory;
  getPickingService?: PickingServiceFactory;
  getOrdersService?: OrdersServiceFactory;
  getWavesService?: WavesServiceFactory;
  getInventoryService?: InventoryServiceFactory;
  getLayoutService?: LayoutServiceFactory;
  getSitesService?: SitesServiceFactory;
  getContainersService?: ContainersServiceFactory;
  getFloorsService?: FloorsServiceFactory;
  getProductsService?: ProductsServiceFactory;
  getProductLocationRolesService?: ProductLocationRolesServiceFactory;
  getStoragePresetsService?: StoragePresetsServiceFactory;
  getPickingPlanningPreviewService?: PickingPlanningPreviewServiceFactory;
};
