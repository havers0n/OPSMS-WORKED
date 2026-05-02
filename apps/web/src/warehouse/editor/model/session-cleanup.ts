import { registerSessionCleanup } from '@/app/session/session-cleanup-registry';
import { resetEditorStore } from '@/warehouse/editor/model/editor-store';
import { resetNavigationStore } from '@/warehouse/editor/model/v2/navigation-store';
import { resetSelectionStore } from '@/warehouse/editor/model/v2/selection-store';
import { resetTaskStore } from '@/warehouse/editor/model/v2/task-store';

let unregisterWarehouseEditorSessionCleanup: (() => void) | null = null;

export function resetWarehouseEditorSessionState() {
  resetEditorStore();
  resetNavigationStore();
  resetSelectionStore();
  resetTaskStore();
}

export function ensureWarehouseEditorSessionCleanupRegistered() {
  if (!unregisterWarehouseEditorSessionCleanup) {
    unregisterWarehouseEditorSessionCleanup = registerSessionCleanup(resetWarehouseEditorSessionState);
  }

  return unregisterWarehouseEditorSessionCleanup;
}
