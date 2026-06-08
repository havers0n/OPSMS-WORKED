import { useEffect, useRef } from 'react';
import type { ViewMode } from '@/warehouse/editor/model/editor-types';
import { useModeStore } from '@/warehouse/editor/model/mode-store';
import { recordStorageDebugCanvasSnapshot } from './storage-debug-diagnostics';
import type { StorageDebugFlags } from './storage-debug-flags';

type ModeStoreSnapshot = {
  viewMode: ViewMode;
};

type ModeStoreSubscribe = (
  listener: (state: ModeStoreSnapshot, previousState: ModeStoreSnapshot) => void
) => () => void;

type UseStorageDebugLifecycleSnapshotsOptions = {
  flags: StorageDebugFlags;
  subscribe?: ModeStoreSubscribe;
  getState?: () => ModeStoreSnapshot;
};

export function useStorageDebugLifecycleSnapshots({
  flags,
  subscribe = useModeStore.subscribe,
  getState = useModeStore.getState
}: UseStorageDebugLifecycleSnapshotsOptions) {
  const storageSnapshotTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => {
    if (!flags.debugEnabled) return undefined;

    const clearSnapshotTimers = () => {
      for (const timer of storageSnapshotTimersRef.current) {
        globalThis.clearTimeout(timer);
      }
      storageSnapshotTimersRef.current = [];
    };

    const scheduleStorageSnapshots = (viewModeForSnapshots: ViewMode) => {
      clearSnapshotTimers();
      const schedule = [
        { delayMs: 0, reason: 'after-entering-storage-mode' as const },
        { delayMs: 100, reason: 'after-entering-storage-mode:100ms' as const },
        { delayMs: 500, reason: 'after-entering-storage-mode:500ms' as const },
        { delayMs: 1000, reason: 'after-entering-storage-mode:1s' as const },
        { delayMs: 2000, reason: 'after-entering-storage-mode:2s' as const }
      ];

      storageSnapshotTimersRef.current = schedule.map(({ delayMs, reason }) =>
        globalThis.setTimeout(() => {
          recordStorageDebugCanvasSnapshot({
            activeWarehouseMode: viewModeForSnapshots,
            snapshotReason: reason,
            currentIsolationFlags: flags
          });
        }, delayMs)
      );
    };

    const unsubscribe = subscribe((state, previousState) => {
      if (previousState.viewMode !== 'storage' && state.viewMode === 'storage') {
        recordStorageDebugCanvasSnapshot({
          activeWarehouseMode: previousState.viewMode,
          snapshotReason: 'before-entering-storage-mode',
          currentIsolationFlags: flags
        });
        scheduleStorageSnapshots('storage');
      }

      if (previousState.viewMode === 'storage' && state.viewMode !== 'storage') {
        clearSnapshotTimers();
        recordStorageDebugCanvasSnapshot({
          activeWarehouseMode: previousState.viewMode,
          snapshotReason: 'leaving-storage-mode',
          currentIsolationFlags: flags
        });
      }
    });

    const onPageHide = () => {
      recordStorageDebugCanvasSnapshot({
        activeWarehouseMode: getState().viewMode,
        snapshotReason: 'pagehide',
        currentIsolationFlags: flags
      });
    };

    window.addEventListener('pagehide', onPageHide);

    return () => {
      clearSnapshotTimers();
      unsubscribe();
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [flags, getState, subscribe]);
}
