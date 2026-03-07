export type WarehouseSetupState =
  | 'bootstrap_required'
  | 'floor_selection_required'
  | 'draft_loading'
  | 'draft_ready'
  | 'error';
