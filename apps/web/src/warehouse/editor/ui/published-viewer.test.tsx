import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishedViewer } from './published-viewer';

let mockViewMode: 'layout' | 'view' | 'storage' = 'storage';
const storageWorkspaceSpy = vi.fn();
const useStorageDebugLifecycleSnapshotsSpy = vi.fn();
let mockStorageDebugFlags = {
  debugEnabled: false,
  disableStorageWorkspace: false,
  disableStorageCanvas: false,
  disableRackLayer: false,
  disableRackCells: false,
  disableRackRuntimeVisuals: false,
  disableRackBodies: false,
  disableCanvasSceneData: false,
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
      activeDraft: null,
      latestPublished: {
        floorId: 'floor-1',
        layoutVersionId: 'layout-1',
        draftVersion: 1,
        versionNo: 1,
        state: 'published',
        zoneIds: [],
        zones: {},
        wallIds: [],
        walls: {},
        rackIds: [],
        racks: {}
      }
    },
    isLoading: false
  })
}));

vi.mock('@/warehouse/editor/model/editor-selectors', () => ({
  useClearSelection: () => () => undefined,
  useInitializeDraft: () => () => undefined,
  useResetDraft: () => () => undefined,
  useSelectedRackId: () => null,
  useSetEditorMode: () => () => undefined,
  useViewMode: () => mockViewMode
}));

vi.mock('@/shared/i18n', () => ({
  useT: () => (key: string) => key
}));

vi.mock('./canvas-diagnostics', () => ({
  markCanvasTimingEnd: () => undefined,
  markCanvasTimingStart: () => undefined,
  recordRoutePreviewAppPhaseMark: () => undefined,
  recordCanvasMode: () => undefined
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

vi.mock('./editor-canvas', () => ({
  EditorCanvas: () => <div data-testid="editor-canvas" />
}));

vi.mock('./inspector-router', () => ({
  InspectorRouter: () => <div data-testid="inspector-router" />
}));

describe('PublishedViewer storage debug gate', () => {
  beforeEach(() => {
    mockViewMode = 'storage';
    storageWorkspaceSpy.mockClear();
    useStorageDebugLifecycleSnapshotsSpy.mockClear();
    mockStorageDebugFlags = {
      debugEnabled: false,
      disableStorageWorkspace: false,
      disableStorageCanvas: false,
      disableRackLayer: false,
      disableRackCells: false,
      disableRackRuntimeVisuals: false,
      disableRackBodies: false,
      disableCanvasSceneData: false,
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

    render(<PublishedViewer />);

    expect(screen.getByTestId('storage-workspace-disabled-placeholder')).toBeTruthy();
    expect(storageWorkspaceSpy).not.toHaveBeenCalled();
    expect(useStorageDebugLifecycleSnapshotsSpy).toHaveBeenCalledWith({
      flags: mockStorageDebugFlags
    });
  });
});
