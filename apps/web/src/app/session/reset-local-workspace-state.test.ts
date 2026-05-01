import { afterEach, describe, expect, it, vi } from 'vitest';
import { useUiStore } from '@/app/store/ui-store';
import { queryClient } from '@/shared/api/supabase/query-client';
import { registerSessionCleanup } from './session-cleanup-registry';
import { resetLocalWorkspaceState } from './reset-local-workspace-state';

let unregisterCleanup: (() => void) | null = null;

afterEach(() => {
  unregisterCleanup?.();
  unregisterCleanup = null;
  vi.restoreAllMocks();
});

describe('resetLocalWorkspaceState', () => {
  it('clears generic workspace state and runs registered cleanup handlers', () => {
    const cleanupHandler = vi.fn();
    const clearQueryClient = vi.spyOn(queryClient, 'clear');
    unregisterCleanup = registerSessionCleanup(cleanupHandler);

    useUiStore.setState({
      activeFloorId: 'floor-1',
      activeSiteId: 'site-1',
      isDrawerCollapsed: false
    });

    resetLocalWorkspaceState();

    expect(clearQueryClient).toHaveBeenCalledOnce();
    expect(useUiStore.getState()).toMatchObject({
      activeFloorId: null,
      activeSiteId: null,
      isDrawerCollapsed: true
    });
    expect(cleanupHandler).toHaveBeenCalledOnce();
  });
});
