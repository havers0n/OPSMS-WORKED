import type { FloorWorkspace } from '@wos/domain';
import { useEffect, useRef, useState } from 'react';
import { PanelRight } from 'lucide-react';
import { useT } from '@/shared/i18n';
import {
  useStorageFocusSelectedCellId,
  useStorageFocusSelectedRackId
} from '../model/v2/v2-selectors';
import { StorageInspectorV2 } from './storage-inspector-v2';
import { StorageNavigator } from './storage-navigator';
import { WorkspaceCanvasAndPanel } from './workspace-canvas-and-panel';

const INSPECTOR_COLLAPSED_KEY = 'wos:storage-inspector-collapsed';

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

  const [inspectorCollapsed, setInspectorCollapsed] = useState(() => {
    try {
      return localStorage.getItem(INSPECTOR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const selectedRackId = useStorageFocusSelectedRackId();
  const selectedCellId = useStorageFocusSelectedCellId();
  const hasSelection = Boolean(selectedRackId || selectedCellId);

  // Auto-expand only when transitioning from no-selection → selection
  const prevHasSelectionRef = useRef(false);
  useEffect(() => {
    if (hasSelection && !prevHasSelectionRef.current) {
      setInspectorCollapsed(false);
    }
    prevHasSelectionRef.current = hasSelection;
  }, [hasSelection]);

  const toggleInspector = () => {
    setInspectorCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(INSPECTOR_COLLAPSED_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div
      role="region"
      aria-label={t('warehouse.storage.region')}
      className="flex h-full w-full overflow-hidden"
    >
      <StorageNavigator workspace={workspace} />

      <WorkspaceCanvasAndPanel
        workspace={workspace}
        onAddRack={onAddRack}
        onOpenInspector={onOpenInspector}
        onCloseInspector={onCloseInspector}
        hideRightPanel
        hideContextPanel
      />

      {hasSelection && (
        <>
          {/* Persistent toggle strip — always visible when there's a selection */}
          <button
            type="button"
            onClick={toggleInspector}
            title={inspectorCollapsed ? t('storage.inspector.show') : t('storage.inspector.hide')}
            aria-expanded={!inspectorCollapsed}
            className="flex h-full w-8 flex-shrink-0 flex-col items-center border-s border-gray-200 bg-white pt-2.5 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
          >
            <PanelRight
              className="h-4 w-4 transition-transform"
              style={{ transform: inspectorCollapsed ? undefined : 'scaleX(-1)' }}
            />
          </button>

          {/* Inspector panel — hidden when collapsed */}
          {!inspectorCollapsed && <StorageInspectorV2 workspace={workspace} />}
        </>
      )}

      {/* No selection: inspector returns null, render nothing */}
      {!hasSelection && <StorageInspectorV2 workspace={workspace} />}
    </div>
  );
}
