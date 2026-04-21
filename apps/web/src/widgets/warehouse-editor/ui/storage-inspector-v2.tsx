import type { FloorWorkspace } from '@wos/domain';
import React from 'react';
import { StorageInspectorV2Surface } from './storage-inspector-v2/storage-inspector-v2-surface';

export { resolvePanelMode, resolveActiveMode } from './storage-inspector-v2/mode';
export type { MoveTaskState } from './storage-inspector-v2/mode';

interface StorageInspectorV2Props {
  workspace: FloorWorkspace | null;
}

export function StorageInspectorV2({ workspace }: StorageInspectorV2Props) {
  return <StorageInspectorV2Surface workspace={workspace} />;
}
