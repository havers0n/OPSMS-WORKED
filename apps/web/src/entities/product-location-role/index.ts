export type { LocationProductAssignment, LocationEffectiveRole } from './api/queries';
export {
  productLocationRoleKeys,
  locationProductAssignmentsQueryOptions,
  locationEffectiveRoleQueryOptions
} from './api/queries';
export { useLocationProductAssignments } from './api/use-location-product-assignments';
export { useLocationEffectiveRole } from './api/use-location-effective-role';
export { useCreateProductLocationRole, useDeleteProductLocationRole } from './api/mutations';
export type { CreateProductLocationRoleInput } from './api/mutations';
