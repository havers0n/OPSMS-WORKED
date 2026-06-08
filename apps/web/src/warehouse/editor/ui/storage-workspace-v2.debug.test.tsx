import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StorageWorkspaceV2 } from './storage-workspace-v2';

const workspaceCanvasAndPanelSpy = vi.fn();

vi.mock('@/shared/i18n', () => ({
  useT: () => (key: string) => key
}));

vi.mock('../model/v2/v2-selectors', () => ({
  useStorageFocusSelectedCellId: () => null,
  useStorageFocusSelectedRackId: () => null
}));

vi.mock('./storage-debug-flags', () => ({
  readStorageDebugFlagsFromWindow: () => ({
    debugEnabled: true,
    disableStorageWorkspace: false,
    disableStorageCanvas: true,
    forceKonvaPixelRatio1: false,
    disableStorageData: false,
    disableInspector: false,
    disableNavigator: false,
    disableOccupancyOverlay: false
  })
}));

vi.mock('./storage-navigator', () => ({
  StorageNavigator: () => <div data-testid="storage-navigator" />
}));

vi.mock('./storage-inspector-v2', () => ({
  StorageInspectorV2: () => <div data-testid="storage-inspector" />
}));

vi.mock('./workspace-canvas-and-panel', () => ({
  WorkspaceCanvasAndPanel: (props: Record<string, unknown>) => {
    workspaceCanvasAndPanelSpy(props);
    return <div data-testid="storage-v2-canvas" />;
  }
}));

describe('StorageWorkspaceV2 debug canvas gate', () => {
  it('prevents WorkspaceCanvasAndPanel mount when disableStorageCanvas=1', () => {
    render(
      <StorageWorkspaceV2
        workspace={null}
        onAddRack={() => undefined}
        onCloseInspector={() => undefined}
      />
    );

    expect(screen.getByTestId('storage-canvas-disabled-placeholder')).toBeTruthy();
    expect(workspaceCanvasAndPanelSpy).not.toHaveBeenCalled();
  });
});
