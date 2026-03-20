export type WarehouseSetupState =
  | 'bootstrap_required'
  | 'floor_selection_required'
  | 'workspace_loading'
  | 'workspace_ready'
  | 'error';
