import {
  ensureWarehouseEditorSessionCleanupRegistered,
  resetWarehouseEditorSessionState
} from '@/warehouse/editor/model/session-cleanup';

export { ensureWarehouseEditorSessionCleanupRegistered };

export function resetWarehouseEditorSession() {
  resetWarehouseEditorSessionState();
}
