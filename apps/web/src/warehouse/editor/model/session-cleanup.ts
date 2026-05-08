import { registerSessionCleanup } from '@/app/session/session-cleanup-registry';
import { resetEditorStore } from '@/warehouse/editor/model/editor-store';
import { resetStorageFocusStore } from '@/warehouse/editor/model/v2/storage-focus-store';
import { resetTaskStore } from '@/warehouse/editor/model/v2/task-store';

let unregisterWarehouseEditorSessionCleanup: (() => void) | null = null;

export function resetWarehouseEditorSessionState() {
  resetEditorStore();
  resetStorageFocusStore();
  resetTaskStore();
}

export function ensureWarehouseEditorSessionCleanupRegistered() {
  if (!unregisterWarehouseEditorSessionCleanup) {
    unregisterWarehouseEditorSessionCleanup = registerSessionCleanup(resetWarehouseEditorSessionState);
  }

  return unregisterWarehouseEditorSessionCleanup;
}
