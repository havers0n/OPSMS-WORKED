import { resetUiStore } from '@/app/store/ui-store';
import { runSessionCleanupHandlers } from '@/app/session/session-cleanup-registry';
import { queryClient } from '@/shared/api/supabase/query-client';

export function resetLocalWorkspaceState() {
  queryClient.clear();
  resetUiStore();
  runSessionCleanupHandlers();
}
