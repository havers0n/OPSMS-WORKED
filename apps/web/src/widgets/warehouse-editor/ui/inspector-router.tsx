import type { FloorWorkspace } from '@wos/domain';
import {
  useCreatingRackId,
  useEditorSelection,
  useViewMode
} from '@/entities/layout-version/model/editor-selectors';
import { RackCreationWizard } from '@/features/rack-create/ui/rack-creation-wizard';
import { useWorkspaceLayout } from '../lib/use-workspace-layout';
import { RackInspector } from './rack-inspector';
import { RackMultiInspector } from './rack-multi-inspector';
import { LayoutEmptyPanel } from './mode-panels/layout-empty-panel';
import { SemanticsModePanel } from './mode-panels/semantics-mode-panel';
import { PlacementModePanel } from './mode-panels/placement-mode-panel';
import { CellPlacementInspector } from './mode-panels/cell-placement-inspector';
import { ContainerPlacementInspector } from './mode-panels/container-placement-inspector';
import { FlowModePanel } from './mode-panels/flow-mode-panel';

// Pure routing logic lives in inspector-router-logic.ts (no React, testable in isolation).
import { resolveInspectorKind } from './inspector-router-logic';
export type { InspectorKind } from './inspector-router-logic';
export { resolveInspectorKind };

// ─── router component ─────────────────────────────────────────────────────────

type InspectorRouterProps = {
  workspace: FloorWorkspace | null;
  /** Called by layout-mode inspectors when the user clicks the close button. */
  onClose: () => void;
  /** Called by LayoutEmptyPanel to trigger rack placement mode. */
  onAddRack: () => void;
};

/**
 * InspectorRouter — the single entry point for the right-side panel.
 *
 * Reads viewMode and selection from the store, resolves the correct inspector
 * kind, and renders it. No other component should decide which inspector to show.
 *
 * Current routing table:
 *   layout  + rack (creating) → RackCreationWizard
 *   layout  + rack(1, existing) → RackInspector (structural)
 *   layout  + rack(≥2)         → RackMultiInspector (spacing/alignment)
 *   layout  + none             → LayoutEmptyPanel
 *   semantics                 → SemanticsModePanel (placeholder)
 *   placement + cell           → CellPlacementInspector (read-only, B2)
 *   placement + container      → ContainerPlacementInspector (read-only, B3)
 *   placement + other          → PlacementModePanel (placeholder)
 *   flow                      → FlowModePanel (placeholder)
 */
export function InspectorRouter({ workspace, onClose, onAddRack }: InspectorRouterProps) {
  const viewMode = useViewMode();
  const selection = useEditorSelection();
  const creatingRackId = useCreatingRackId();
  const layoutDraft = useWorkspaceLayout(workspace);

  const kind = resolveInspectorKind(viewMode, selection, creatingRackId);

  switch (kind) {
    case 'rack-creation-wizard': {
      const primaryId = selection.type === 'rack' ? selection.rackIds[0] : null;
      const rack = primaryId && layoutDraft ? layoutDraft.racks[primaryId] ?? null : null;
      // Guard: if the draft doesn't contain the rack yet (transient state), fall
      // back to the empty panel rather than crashing.
      if (!rack) return <LayoutEmptyPanel workspace={workspace} onAddRack={onAddRack} />;
      return <RackCreationWizard rack={rack} />;
    }

    case 'rack-structure':
      return <RackInspector onClose={onClose} />;

    case 'rack-multi':
      return <RackMultiInspector onClose={onClose} />;

    case 'layout-empty':
      return <LayoutEmptyPanel workspace={workspace} onAddRack={onAddRack} />;

    case 'semantics-placeholder':
      return <SemanticsModePanel />;

    case 'placement-cell':
      return <CellPlacementInspector workspace={workspace} />;

    case 'placement-container':
      return <ContainerPlacementInspector workspace={workspace} />;

    case 'placement-placeholder':
      return <PlacementModePanel />;

    case 'flow-placeholder':
      return <FlowModePanel />;
  }
}
