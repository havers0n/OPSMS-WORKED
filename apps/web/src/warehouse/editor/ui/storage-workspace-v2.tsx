import type { FloorWorkspace } from '@wos/domain';
import { useEffect, useRef, useState } from 'react';
import { PanelRight, X } from 'lucide-react';
import { useT } from '@/shared/i18n';
import {
  useStorageFocusSelectedCellId,
  useStorageFocusSelectedRackId
} from '../model/v2/v2-selectors';
import { StorageInspectorV2 } from './storage-inspector-v2';
import { StorageNavigator } from './storage-navigator';
import { WorkspaceCanvasAndPanel } from './workspace-canvas-and-panel';
import { recordClientRuntimeEvent } from '@/shared/diagnostics/client-runtime-diagnostics';
import { StorageDebugPlaceholder } from './storage-debug-placeholder';
import { readStorageDebugFlagsFromWindow } from './storage-debug-flags';
import {
  recordStorageBreadcrumb,
  clearStorageBreadcrumbs,
  startStorageHeartbeat,
  stopStorageHeartbeat
} from '@/shared/diagnostics/storage-diagnostics';

const INSPECTOR_MODE_KEY = 'wos:storage-inspector-mode';

type InspectorMode = 'hidden' | 'peek' | 'expanded';

interface StorageWorkspaceV2Props {
  workspace: FloorWorkspace | null;
  onAddRack: () => void;
  /** Optional legacy wiring; currently no-op in WarehouseEditor. */
  onOpenInspector?: () => void;
  onCloseInspector: () => void;
}

/**
 * StorageWorkspaceV2 — Dumb composition root for storage mode V2
 *
 * This is a gated alternative to the legacy WarehouseEditor when in storage mode.
 * It composes:
 * - StorageNavigator (left panel, V2 surface)
 * - WorkspaceCanvasAndPanel (center + right, shared with legacy path)
 *
 * All state and handlers are received from parent (WarehouseEditor).
 * This is pure composition with no local logic.
 *
 * **Relationship to PR1–PR7:**
 * - PR1: V2 state primitives (navigation, selection, task stores)
 * - PR2: StorageNavigator shell component
 * - PR3: This workspace container (gated V2 host)
 * - PR4: StorageNavigator made interactive (selection wired to selection-store)
 * - PR5: StorageInspectorV2 mounted here; legacy RightSidePanelSlot suppressed in V2 path
 * - PR6: workspace threaded to navigator + inspector for real data cutover
 * - PR7: isStorageV2 + hideContextPanel passed; StorageFocusStore is now sole V2 focus writer
 *
 * **Enabled by:** ENABLE_STORAGE_WORKSPACE_V2 const in warehouse-editor.tsx
 */
export function StorageWorkspaceV2({
  workspace,
  onAddRack,
  onOpenInspector,
  onCloseInspector
}: StorageWorkspaceV2Props) {
  const t = useT();
  const storageDebugFlags = readStorageDebugFlagsFromWindow();
  const debugFlags = {
    disableOccupancyOverlay: storageDebugFlags.disableOccupancyOverlay,
    disableNavigator: storageDebugFlags.disableNavigator,
    disableInspector: storageDebugFlags.disableInspector,
    disableStorageData: storageDebugFlags.disableStorageData
  };

  const [inspectorMode, setInspectorMode] = useState<InspectorMode>(() => {
    try {
      const stored = localStorage.getItem(INSPECTOR_MODE_KEY);
      if (stored === 'hidden' || stored === 'peek' || stored === 'expanded') return stored;
    } catch {
      // ignore
    }
    return 'hidden';
  });

  const selectedRackId = useStorageFocusSelectedRackId();
  const selectedCellId = useStorageFocusSelectedCellId();
  const hasSelection = Boolean(selectedRackId || selectedCellId);

  // On new selection: open to peek if currently hidden.
  // On selection clear: collapse to hidden.
  const prevHasSelectionRef = useRef(false);
  useEffect(() => {
    if (hasSelection && !prevHasSelectionRef.current) {
      setInspectorMode((prev) => (prev === 'hidden' ? 'peek' : prev));
    }
    if (!hasSelection) {
      setInspectorMode('hidden');
    }
    prevHasSelectionRef.current = hasSelection;
  }, [hasSelection]);

  // Reopen sheet when a cell is explicitly (re-)selected even if hasSelection was already
  // true (e.g. rack remained focused after cell was cleared, or the sheet was manually
  // closed while the cell was still selected and the user selects a cell again).
  useEffect(() => {
    if (selectedCellId !== null) {
      setInspectorMode((prev) => (prev === 'hidden' ? 'peek' : prev));
    }
  }, [selectedCellId]);

  const persistMode = (mode: InspectorMode) => {
    try {
      localStorage.setItem(INSPECTOR_MODE_KEY, mode);
    } catch {
      // ignore
    }
  };

  // Desktop: toggle strip cycles hidden ↔ expanded (peek is a mobile-only concept).
  const toggleDesktop = () => {
    setInspectorMode((prev) => {
      const next = prev === 'hidden' ? 'expanded' : 'hidden';
      persistMode(next);
      return next;
    });
  };

  // Mobile: drag handle tap cycles peek ↔ expanded.
  const toggleMobilePeek = () => {
    setInspectorMode((prev) => {
      const next = prev === 'peek' ? 'expanded' : 'peek';
      persistMode(next);
      return next;
    });
  };

  const inspectorVisible = inspectorMode !== 'hidden';

  useEffect(() => {
    recordStorageBreadcrumb('storage-mode-entered', {
      floorId: workspace?.floorId ?? null,
      hasWorkspace: Boolean(workspace),
      debugFlags
    });
    clearStorageBreadcrumbs();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!storageDebugFlags.debugEnabled) return;

    startStorageHeartbeat({
      getRoute: () => window.location.pathname + window.location.search,
      getActiveWarehouseMode: () => 'storage',
      getFloorId: () => workspace?.floorId ?? null,
      getPublishedCellCount: () => 0,
      getOccupancyRowCount: () => 0,
      getNavigatorItemCount: () => null,
      getDebugFlags: () => debugFlags
    });

    return () => {
      stopStorageHeartbeat();
    };
  }, [storageDebugFlags.debugEnabled, workspace?.floorId, debugFlags]);

  useEffect(() => {
    recordClientRuntimeEvent('storage-workspace-v2:mount', {
      hasWorkspace: Boolean(workspace)
    });
  }, [workspace]);

  useEffect(() => {
    recordClientRuntimeEvent('storage-workspace-v2:selection', {
      hasSelection,
      selectedRackId,
      selectedCellId,
      inspectorMode
    });
  }, [hasSelection, inspectorMode, selectedCellId, selectedRackId]);

  // Mobile sheet height class per mode.
  const mobileSheetClass =
    inspectorMode === 'expanded'
      ? 'max-sm:h-[90vh]'
      : inspectorMode === 'peek'
        ? 'max-sm:h-[40vh]'
        : 'max-sm:h-0 max-sm:overflow-hidden';

  return (
    <div
      role="region"
      aria-label={t('warehouse.storage.region')}
      className="relative flex h-full w-full overflow-hidden"
    >
      {debugFlags.disableNavigator ? null : <StorageNavigator workspace={workspace} />}

      {storageDebugFlags.disableStorageCanvas ? (
        <StorageDebugPlaceholder
          testId="storage-canvas-disabled-placeholder"
          title="Storage canvas disabled"
          body="Debug flag disableStorageCanvas=1 prevented WorkspaceCanvasAndPanel and EditorCanvas from mounting."
        />
      ) : (
        <WorkspaceCanvasAndPanel
          workspace={workspace}
          onAddRack={onAddRack}
          onOpenInspector={onOpenInspector}
          onCloseInspector={onCloseInspector}
          hideRightPanel
          hideContextPanel
        />
      )}

      {/* Semi-transparent backdrop behind expanded sheet (mobile only). */}
      {hasSelection && inspectorMode === 'expanded' && (
        <div
          className="fixed inset-0 z-10 bg-black/20 sm:hidden"
          aria-hidden="true"
          onClick={() => {
            setInspectorMode('peek');
            persistMode('peek');
          }}
        />
      )}

      {hasSelection && (
        /*
         * On mobile (max-sm): fixed bottom sheet — canvas stays at least 60% visible
         *   in peek (40 vh sheet) and has a backdrop in expanded (90 vh).
         * On sm+: sm:contents makes this div layout-transparent so the toggle strip
         *   and inspector panel are direct flex siblings of the root row.
         */
        <div
          className={[
            'sm:contents',
            'max-sm:fixed max-sm:bottom-0 max-sm:inset-x-0 max-sm:z-20',
            'max-sm:flex max-sm:flex-col',
            'max-sm:rounded-t-2xl max-sm:bg-white',
            'max-sm:shadow-[0_-4px_20px_rgba(0,0,0,0.10)]',
            'max-sm:transition-[height] max-sm:duration-300 max-sm:ease-in-out',
            mobileSheetClass
          ].join(' ')}
        >
          {/* Mobile sheet header: centered drag handle (peek ↔ expanded) + close button. */}
          <div className="sm:hidden flex items-center justify-between px-3 pt-2 pb-1 flex-shrink-0">
            {/* Balancing spacer so handle stays visually centered */}
            <div className="w-6" />
            <button
              type="button"
              className="flex flex-1 items-center justify-center focus-visible:outline-none"
              onClick={toggleMobilePeek}
              aria-label={
                inspectorMode === 'peek'
                  ? t('storage.inspector.expand')
                  : t('storage.inspector.hide')
              }
            >
              <span className="h-1 w-10 rounded-full bg-gray-300" />
            </button>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center text-gray-400 hover:text-gray-600"
              onClick={() => {
                setInspectorMode('hidden');
                persistMode('hidden');
              }}
              aria-label={t('storage.inspector.hide')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Desktop toggle strip — always visible when there's a selection. */}
          <button
            type="button"
            onClick={toggleDesktop}
            title={inspectorVisible ? t('storage.inspector.hide') : t('storage.inspector.show')}
            aria-expanded={inspectorVisible}
            className="max-sm:hidden flex h-full w-8 flex-shrink-0 flex-col items-center border-s border-gray-200 bg-white pt-2.5 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
          >
            <PanelRight
              className="h-4 w-4 transition-transform"
              style={{ transform: inspectorVisible ? 'scaleX(-1)' : undefined }}
            />
          </button>

          {inspectorVisible && !debugFlags.disableInspector && <StorageInspectorV2 workspace={workspace} />}
        </div>
      )}

      {/* No selection: render inspector so its hooks keep running (returns null internally). */}
      {!hasSelection && !debugFlags.disableInspector && <StorageInspectorV2 workspace={workspace} />}
    </div>
  );
}
