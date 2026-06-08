import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WarehouseEditor } from './warehouse-editor';

let mockViewMode: 'layout' | 'view' | 'storage' = 'storage';
const storageWorkspaceSpy = vi.fn();
const useStorageDebugLifecycleSnapshotsSpy = vi.fn();
let mockStorageDebugFlags = {
  debugEnabled: false,
  disableStorageWorkspace: false,
  disableStorageCanvas: false,
  forceKonvaPixelRatio1: false,
  disableStorageData: false,
  disableInspector: false,
  disableNavigator: false,
  disableOccupancyOverlay: false
};

vi.mock('@/app/store/ui-selectors', () => ({
  useActiveFloorId: () => 'floor-1'
}));

vi.mock('@/entities/layout-version/api/use-floor-workspace', () => ({
  useFloorWorkspace: () => ({
    data: {
      floorId: 'floor-1',
      activeDraft: {
        floorId: 'floor-1',
        layoutVersionId: 'layout-1',
        draftVersion: 1,
        versionNo: 1,
        state: 'draft',
        zoneIds: [],
        zones: {},
        wallIds: [],
        walls: {},
        rackIds: [],
        racks: {}
      },
      latestPublished: null
    }
  })
}));

vi.mock('@/features/layout-draft-save/model/use-layout-draft-autosave', () => ({
  useLayoutDraftAutosave: () => undefined
}));

vi.mock('@/warehouse/editor/model/editor-selectors', () => ({
  useClearSelection: () => () => undefined,
  useInitializeDraft: () => () => undefined,
  useLayoutDraftState: () => ({
    floorId: 'floor-1',
    layoutVersionId: 'layout-1',
    draftVersion: 1,
    versionNo: 1,
    state: 'draft',
    zoneIds: [],
    zones: {},
    wallIds: [],
    walls: {},
    rackIds: [],
    racks: {}
  }),
  useResetDraft: () => () => undefined,
  useSetEditorMode: () => () => undefined
}));

vi.mock('@/warehouse/editor/model/mode-store', async () => {
  const actual = await vi.importActual<typeof import('@/warehouse/editor/model/mode-store')>(
    '@/warehouse/editor/model/mode-store'
  );

  return {
    ...actual,
    useModeStore: Object.assign(
      (selector: (state: { viewMode: 'layout' | 'view' | 'storage' }) => unknown) =>
        selector({ viewMode: mockViewMode }),
      { subscribe: vi.fn(() => () => undefined), getState: () => ({ viewMode: mockViewMode }) }
    )
  };
});

vi.mock('@/shared/i18n', () => ({
  useT: () => (key: string) => key
}));

vi.mock('./storage-debug-flags', () => ({
  resolveStorageDebugFlags: () => mockStorageDebugFlags
}));

vi.mock('./use-storage-debug-lifecycle-snapshots', () => ({
  useStorageDebugLifecycleSnapshots: (args: unknown) =>
    useStorageDebugLifecycleSnapshotsSpy(args)
}));

vi.mock('./storage-workspace-v2', () => ({
  StorageWorkspaceV2: (props: Record<string, unknown>) => {
    storageWorkspaceSpy(props);
    return <div data-testid="storage-workspace-v2" />;
  }
}));

vi.mock('./tool-rail', () => ({
  ToolRail: () => <div data-testid="tool-rail" />
}));

vi.mock('./view-workspace', () => ({
  ViewWorkspace: () => <div data-testid="view-workspace" />
}));

vi.mock('./workspace-canvas-and-panel', () => ({
  WorkspaceCanvasAndPanel: () => <div data-testid="workspace-canvas-and-panel" />
}));

describe('WarehouseEditor storage debug gate', () => {
  beforeEach(() => {
    mockViewMode = 'storage';
    storageWorkspaceSpy.mockClear();
    useStorageDebugLifecycleSnapshotsSpy.mockClear();
    mockStorageDebugFlags = {
      debugEnabled: false,
      disableStorageWorkspace: false,
      disableStorageCanvas: false,
      forceKonvaPixelRatio1: false,
      disableStorageData: false,
      disableInspector: false,
      disableNavigator: false,
      disableOccupancyOverlay: false
    };
  });

  it('prevents StorageWorkspaceV2 mount when disableStorageWorkspace=1', () => {
    mockStorageDebugFlags = {
      ...mockStorageDebugFlags,
      debugEnabled: true,
      disableStorageWorkspace: true
    };

    render(<WarehouseEditor />);

    expect(screen.getByTestId('storage-workspace-disabled-placeholder')).toBeTruthy();
    expect(storageWorkspaceSpy).not.toHaveBeenCalled();
    expect(useStorageDebugLifecycleSnapshotsSpy).toHaveBeenCalledWith({
      flags: mockStorageDebugFlags
    });
  });
});
