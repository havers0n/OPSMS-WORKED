import type { StorageDebugFlags } from './storage-debug-flags';
import { StorageDebugPlaceholder } from './storage-debug-placeholder';

export function shouldDisableStorageWorkspace(flags: StorageDebugFlags) {
  return flags.disableStorageWorkspace;
}

type StorageWorkspaceDebugGateProps = {
  flags: StorageDebugFlags;
};

export function StorageWorkspaceDebugGate({
  flags
}: StorageWorkspaceDebugGateProps) {
  if (!shouldDisableStorageWorkspace(flags)) return null;

  return (
    <StorageDebugPlaceholder
      testId="storage-workspace-disabled-placeholder"
      title="Storage workspace disabled"
      body="Debug flag disableStorageWorkspace=1 prevented StorageWorkspaceV2 from mounting."
    />
  );
}
