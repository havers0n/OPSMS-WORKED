// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStorageDebugLifecycleSnapshots } from './use-storage-debug-lifecycle-snapshots';

const recordStorageDebugCanvasSnapshotSpy = vi.fn();

vi.mock('./storage-debug-diagnostics', () => ({
  recordStorageDebugCanvasSnapshot: (args: unknown) =>
    recordStorageDebugCanvasSnapshotSpy(args)
}));

const debugFlags = {
  debugEnabled: true,
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
} as const;

describe('useStorageDebugLifecycleSnapshots', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  it('schedules storage lifecycle snapshots', () => {
    let listener:
      | ((state: { viewMode: 'layout' | 'view' | 'storage' }, previousState: { viewMode: 'layout' | 'view' | 'storage' }) => void)
      | null = null;
    const subscribe = vi.fn((cb) => {
      listener = cb;
      return vi.fn();
    });

    renderHook(() =>
      useStorageDebugLifecycleSnapshots({
        flags: debugFlags,
        subscribe,
        getState: () => ({ viewMode: 'storage' })
      })
    );

    act(() => {
      listener?.({ viewMode: 'storage' }, { viewMode: 'view' });
    });

    expect(recordStorageDebugCanvasSnapshotSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotReason: 'before-entering-storage-mode'
      })
    );

    act(() => {
      vi.advanceTimersByTime(0);
      vi.advanceTimersByTime(100);
      vi.advanceTimersByTime(400);
      vi.advanceTimersByTime(500);
      vi.advanceTimersByTime(1000);
    });

    expect(
      recordStorageDebugCanvasSnapshotSpy.mock.calls.map(
        ([arg]) => (arg as { snapshotReason: string }).snapshotReason
      )
    ).toEqual([
      'storage-host-mounted',
      'before-entering-storage-mode',
      'after-entering-storage-mode',
      'after-entering-storage-mode:100ms',
      'after-entering-storage-mode:500ms',
      'after-entering-storage-mode:1s',
      'after-entering-storage-mode:2s'
    ]);

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(recordStorageDebugCanvasSnapshotSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        snapshotReason: 'pagehide'
      })
    );

    act(() => {
      listener?.({ viewMode: 'view' }, { viewMode: 'storage' });
    });

    expect(recordStorageDebugCanvasSnapshotSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        snapshotReason: 'leaving-storage-mode'
      })
    );
  });

  it('clears timers and removes pagehide listener on cleanup', () => {
    let listener:
      | ((state: { viewMode: 'layout' | 'view' | 'storage' }, previousState: { viewMode: 'layout' | 'view' | 'storage' }) => void)
      | null = null;
    const unsubscribe = vi.fn();
    const subscribe = vi.fn((cb) => {
      listener = cb;
      return unsubscribe;
    });
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() =>
      useStorageDebugLifecycleSnapshots({
        flags: debugFlags,
        subscribe,
        getState: () => ({ viewMode: 'storage' })
      })
    );

    act(() => {
      listener?.({ viewMode: 'storage' }, { viewMode: 'view' });
    });

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'pagehide',
      expect.any(Function)
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'pagehide',
      expect.any(Function)
    );
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('fires a host-mount snapshot when already mounted in storage mode', () => {
    renderHook(() =>
      useStorageDebugLifecycleSnapshots({
        flags: debugFlags,
        subscribe: () => vi.fn(),
        getState: () => ({ viewMode: 'storage' })
      })
    );

    expect(recordStorageDebugCanvasSnapshotSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotReason: 'storage-host-mounted',
        activeWarehouseMode: 'storage'
      })
    );
  });
});
