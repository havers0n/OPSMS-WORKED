import { describe, expect, it } from 'vitest';
import { resetLocalWorkspaceState } from './auth-provider';
import { useStorageFocusStore } from '@/widgets/warehouse-editor/model/v2/storage-focus-store';

describe('resetLocalWorkspaceState', () => {
  it('resets StorageFocusStore to canonical empty state', () => {
    useStorageFocusStore.getState().selectCell({
      cellId: 'cell-auth-1',
      rackId: 'rack-auth-1',
      level: 5
    });

    resetLocalWorkspaceState();

    expect(useStorageFocusStore.getState()).toMatchObject({
      selectedCellId: null,
      selectedRackId: null,
      activeLevel: null,
      _consecutiveEmptyCanvasClicks: 0
    });
  });
});
