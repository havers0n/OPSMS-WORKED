import { resetUiStore } from '@/app/store/ui-store';
import { queryClient } from '@/shared/api/supabase/query-client';
import { resetEditorStore } from '@/widgets/warehouse-editor/model/editor-store';
import { resetNavigationStore } from '@/widgets/warehouse-editor/model/v2/navigation-store';
import { resetSelectionStore } from '@/widgets/warehouse-editor/model/v2/selection-store';
import { resetTaskStore } from '@/widgets/warehouse-editor/model/v2/task-store';

export function resetLocalWorkspaceState() {
  queryClient.clear();
  resetUiStore();
  resetEditorStore();
  resetNavigationStore();
  resetSelectionStore();
  resetTaskStore();
}
