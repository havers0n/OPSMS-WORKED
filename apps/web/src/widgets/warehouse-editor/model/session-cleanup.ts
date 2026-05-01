import { registerSessionCleanup } from '@/app/session/session-cleanup-registry';
import { resetEditorStore } from '@/widgets/warehouse-editor/model/editor-store';
import { resetNavigationStore } from '@/widgets/warehouse-editor/model/v2/navigation-store';
import { resetSelectionStore } from '@/widgets/warehouse-editor/model/v2/selection-store';
import { resetTaskStore } from '@/widgets/warehouse-editor/model/v2/task-store';

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
