import {
  ensureWarehouseEditorSessionCleanupRegistered,
  resetWarehouseEditorSessionState
} from '@/widgets/warehouse-editor/model/session-cleanup';

export { ensureWarehouseEditorSessionCleanupRegistered };

export function resetWarehouseEditorSession() {
  resetWarehouseEditorSessionState();
}
