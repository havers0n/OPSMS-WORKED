/**
 * ContextPanel — a focused temporary workspace surface.
 *
 * Sits between the local bar (compact launcher) and the right inspector
 * (persistent truth surface). It shows the current interaction context:
 * object summary, next-step actions, workflow state.
 *
 * PR-4: Layout rack body/side branches plus Storage `cell-context` and workflow
 * branches for selected cells and container moves.
 */
import { generatePreviewCells, validateLayoutDraft } from '@wos/domain';
import type {
  FloorWorkspace,
  LayoutValidationIssue,
  Rack,
  Wall,
  Zone
} from '@wos/domain';
import {
  AlertTriangle,
  ArrowRightLeft,
  Box,
  CheckCircle2,
  Copy,
  Eye,
  Info,
  Layers,
  Lock,
  MapPin,
  Maximize2,
  Minimize2,
  MousePointer2,
  MoveRight,
  Package,
  PackagePlus,
  PlusCircle,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  XCircle
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  useCreateWallFromRackSide,
  useDeleteRack,
  useDeleteWall,
  useDeleteZone,
  useDraftDirtyState,
  useDuplicateRack,
  useEditorMode,
  useEditorSelection,
  useInteractionScope,
  useIsLayoutEditable,
  useContextPanelMode,
  useRotateRack,
  useSelectedRackFocus,
  useSelectedRackId,
  useSelectedWallId,
  useSelectedZoneId,
  useSetEditorMode,
  useSetSelectedRackId,
  useStartPlacementMove,
  useToggleContextPanelMode,
  useViewMode
} from '@/entities/layout-version/model/editor-selectors';
import type {
  ContextPanelMode,
  RackSideFocus
} from '@/entities/layout-version/model/editor-types';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { useCachedLayoutValidation } from '@/features/layout-validate/model/use-layout-validation';
import { useWorkspaceLayout } from '../lib/use-workspace-layout';
import { resolveContextPanelIntent, type ContextPanelIntent } from './context-panel-logic';
import { StorageCellContextPanel } from './mode-panels/storage-cell-context-panel';
import { StorageWorkflowContextPanel } from './mode-panels/storage-workflow-context-panel';

// Re-export for use by other modules
export { resolveContextPanelIntent, type ContextPanelIntent } from './context-panel-logic';

// ─── intent display config ──────────────────────────────────────────────────

const INTENT_CONFIG: Record<
  Exclude<ContextPanelIntent, 'hidden'>,
  { icon: typeof Info; label: string; description: string }
> = {
  'rack-context': {
    icon: Box,
    label: 'Rack context',
    description: 'Rack actions and summary will appear here.'
  },
  'rack-side-context': {
    icon: Box,
    label: 'Rack side',
    description: 'Side actions and adjacency context will appear here.'
  },
  'multi-rack': {
    icon: Layers,
    label: 'Multi-rack context',
    description: 'Alignment and spacing controls will appear here.'
  },
  'zone-context': {
    icon: MapPin,
    label: 'Zone context',
    description: 'Zone summary and next-step actions will appear here.'
  },
  'wall-context': {
    icon: Layers,
    label: 'Wall context',
    description: 'Wall summary and next-step actions will appear here.'
  },
  'cell-context': {
    icon: Package,
    label: 'Cell context',
    description: 'Cell actions and occupancy summary will appear here.'
  },
  'container-context': {
    icon: Package,
    label: 'Container context',
    description: 'Container actions and details will appear here.'
  },
  'idle-view': {
    icon: Eye,
    label: 'View idle',
    description: 'Select a rack, cell, or container to inspect read-only detail.'
  },
  'idle-storage': {
    icon: Package,
    label: 'Storage idle',
    description: 'Select a cell to inspect current stock and launch storage actions.'
  },
  'idle-layout': {
    icon: MousePointer2,
    label: 'Layout idle',
    description: 'Select a rack to inspect structure, or place a new rack.'
  },
  workflow: {
    icon: ArrowRightLeft,
    label: 'Workflow active',
    description: 'Workflow state and progress will appear here.'
  }
};

function formatRackKind(kind: Rack['kind']) {
  return kind === 'paired' ? 'Paired rack' : 'Single rack';
}

function countRackSections(rack: Rack) {
  return rack.faces.reduce((total, face) => total + face.sections.length, 0);
}

function formatZoneCategory(category: Zone['category']) {
  if (!category) {
    return 'No category';
  }

  return `${category.slice(0, 1).toUpperCase()}${category.slice(1)}`;
}

function formatWallType(wallType: Wall['wallType']) {
  if (!wallType) {
    return 'No type';
  }

  return `${wallType.slice(0, 1).toUpperCase()}${wallType.slice(1)}`;
}

function filterRackIssues(rack: Rack, issues: LayoutValidationIssue[]) {
  return issues.filter(
    (issue) =>
      !issue.entityId ||
      issue.entityId === rack.id ||
      rack.faces.some((face) => face.id === issue.entityId)
  );
}

function getRackValidationSummary(issues: LayoutValidationIssue[]) {
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;

  if (errorCount > 0) {
    return {
      icon: XCircle,
      label: `${errorCount} error${errorCount > 1 ? 's' : ''}`,
      style: {
        background: '#fef2f2',
        color: '#b91c1c'
      }
    };
  }

  if (warningCount > 0) {
    return {
      icon: AlertTriangle,
      label: `${warningCount} warning${warningCount > 1 ? 's' : ''}`,
      style: {
        background: '#fffbeb',
        color: '#b45309'
      }
    };
  }

  return {
    icon: CheckCircle2,
    label: 'Valid',
    style: {
      background: '#ecfdf5',
      color: '#047857'
    }
  };
}

const RACK_SIDE_LABELS: Record<RackSideFocus, string> = {
  north: 'North side',
  east: 'East side',
  south: 'South side',
  west: 'West side'
};

function RackContextPanel({
  workspace
}: {
  workspace: FloorWorkspace | null;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const layoutDraft = useWorkspaceLayout(workspace);
  const selectedRackId = useSelectedRackId();
  const isLayoutEditable = useIsLayoutEditable();
  const isDraftDirty = useDraftDirtyState();
  const rotateRack = useRotateRack();
  const duplicateRack = useDuplicateRack();
  const deleteRack = useDeleteRack();

  const rack = layoutDraft && selectedRackId ? layoutDraft.racks[selectedRackId] : null;
  const cachedValidation = useCachedLayoutValidation(layoutDraft?.layoutVersionId ?? null);

  useEffect(() => {
    setConfirmingDelete(false);
  }, [selectedRackId]);

  const cellCount = useMemo(() => {
    if (!layoutDraft || !rack) return 0;

    return generatePreviewCells({
      ...layoutDraft,
      rackIds: [rack.id],
      racks: { [rack.id]: rack }
    }).length;
  }, [layoutDraft, rack]);

  const rackIssues = useMemo(() => {
    if (!layoutDraft || !rack) return [];

    const previewValidation = validateLayoutDraft(layoutDraft);
    const activeValidation =
      !isDraftDirty && cachedValidation.data ? cachedValidation.data : previewValidation;

    return filterRackIssues(rack, activeValidation.issues);
  }, [cachedValidation.data, isDraftDirty, layoutDraft, rack]);

  if (!rack) {
    return <PlaceholderContent description="Rack context is unavailable for the current selection." />;
  }

  const sectionCount = countRackSections(rack);
  const status = getRackValidationSummary(rackIssues);
  const StatusIcon = status.icon;

  return (
    <div className="px-3 py-3">
      <div className="rounded-xl border border-[var(--border-muted)] bg-white p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900" title={rack.displayCode}>
              Rack {rack.displayCode}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {formatRackKind(rack.kind)}
            </div>
          </div>

          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold"
            style={status.style}
          >
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </span>
        </div>

        <div className="mt-3 text-[11px] text-slate-600">
          {rack.totalLength.toFixed(1)} m x {rack.depth.toFixed(1)} m | {rack.rotationDeg} deg
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            { label: 'Sections', value: String(sectionCount) },
            { label: 'Cells', value: String(cellCount) }
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-2.5 py-2"
            >
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {label}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-slate-800">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {isLayoutEditable && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <ContextActionButton
            label="Rotate"
            icon={RotateCcw}
            onClick={() => rotateRack(rack.id)}
          />
          <ContextActionButton
            label="Duplicate"
            icon={Copy}
            onClick={() => duplicateRack(rack.id)}
          />
          {!confirmingDelete ? (
            <ContextActionButton
              label="Delete"
              icon={Trash2}
              variant="danger"
              className="col-span-2"
              onClick={() => setConfirmingDelete(true)}
            />
          ) : (
            <div className="col-span-2 grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-red-200 bg-red-50 p-2">
              <div className="self-center px-1 text-[11px] font-medium text-red-600">
                Delete this rack?
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-lg border border-[var(--border-muted)] bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteRack(rack.id);
                    setConfirmingDelete(false);
                  }}
                  className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RackSideContextPanel({
  workspace
}: {
  workspace: FloorWorkspace | null;
}) {
  const layoutDraft = useWorkspaceLayout(workspace);
  const selectedRackId = useSelectedRackId();
  const selectedRackFocus = useSelectedRackFocus();
  const isLayoutEditable = useIsLayoutEditable();
  const createWallFromRackSide = useCreateWallFromRackSide();
  const setEditorMode = useSetEditorMode();
  const setSelectedRackId = useSetSelectedRackId();

  const rack = layoutDraft && selectedRackId ? layoutDraft.racks[selectedRackId] : null;
  const side = selectedRackFocus.type === 'side' ? selectedRackFocus.side : null;

  if (!rack || !side) {
    return <PlaceholderContent description="Rack side context is unavailable for the current selection." />;
  }

  return (
    <div className="px-3 py-3">
      <div className="rounded-xl border border-[var(--border-muted)] bg-white p-3">
        <div className="text-sm font-semibold text-slate-900">Rack {rack.displayCode}</div>
        <div className="mt-1 text-xs font-medium text-[var(--accent)]">
          {RACK_SIDE_LABELS[side]}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Use this edge for adjacency and access launchers. Full rack structure stays in the inspector.
        </p>
        <button
          type="button"
          onClick={() => setSelectedRackId(rack.id)}
          className="mt-3 text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
        >
          Back to rack body
        </button>
      </div>

      <div className="mt-3 grid gap-2">
        <ContextActionButton
          label="Add rack here"
          icon={Box}
          disabled={!isLayoutEditable}
          onClick={() => {
            setSelectedRackId(null);
            setEditorMode('place');
          }}
        />
        <ContextActionButton
          label="Add wall here"
          icon={Layers}
          disabled={!isLayoutEditable}
          onClick={() => createWallFromRackSide(rack.id, side)}
        />
        <ContextActionButton
          label="Mark aisle/access"
          icon={ArrowRightLeft}
          disabled
          onClick={() => undefined}
        />
      </div>
    </div>
  );
}

function WallContextPanel({
  workspace,
  onOpenInspector
}: {
  workspace: FloorWorkspace | null;
  onOpenInspector: () => void;
}) {
  const layoutDraft = useWorkspaceLayout(workspace);
  const selectedWallId = useSelectedWallId();
  const deleteWall = useDeleteWall();
  const isLayoutEditable = useIsLayoutEditable();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const wall = layoutDraft && selectedWallId ? layoutDraft.walls[selectedWallId] : null;

  useEffect(() => {
    setConfirmingDelete(false);
  }, [selectedWallId]);

  if (!wall) {
    return <PlaceholderContent description="Wall context is unavailable for the current selection." />;
  }

  const wallLength = Math.abs(wall.x2 - wall.x1) + Math.abs(wall.y2 - wall.y1);
  const orientation = wall.y1 === wall.y2 ? 'Horizontal' : 'Vertical';

  return (
    <div className="px-3 py-3">
      <div className="rounded-xl border border-[var(--border-muted)] bg-white p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900" title={wall.name ?? wall.code}>
              {wall.name ?? wall.code}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {wall.code} | {formatWallType(wall.wallType)}
            </div>
          </div>

          <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
            {wall.blocksRackPlacement ? 'Blocking' : 'Non-blocking'}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            { label: 'Length', value: `${Math.round(wallLength)} px` },
            { label: 'Axis', value: orientation }
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-2.5 py-2"
            >
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {label}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-slate-800">{value}</div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          Drag the segment or its endpoints on the canvas. Stable metadata and coordinates stay in the inspector.
        </p>
      </div>

      <div className="mt-3 grid gap-2">
        <ContextActionButton
          label="Inspect wall"
          icon={SlidersHorizontal}
          onClick={onOpenInspector}
        />

        {isLayoutEditable && (
          !confirmingDelete ? (
            <ContextActionButton
              label="Delete wall"
              icon={Trash2}
              variant="danger"
              onClick={() => setConfirmingDelete(true)}
            />
          ) : (
            <div className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-red-200 bg-red-50 p-2">
              <div className="self-center px-1 text-[11px] font-medium text-red-600">
                Delete this wall?
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-lg border border-[var(--border-muted)] bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteWall(wall.id);
                    setConfirmingDelete(false);
                  }}
                  className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function ZoneContextPanel({
  workspace,
  onOpenInspector
}: {
  workspace: FloorWorkspace | null;
  onOpenInspector: () => void;
}) {
  const layoutDraft = useWorkspaceLayout(workspace);
  const selectedZoneId = useSelectedZoneId();
  const deleteZone = useDeleteZone();
  const isLayoutEditable = useIsLayoutEditable();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const zone = layoutDraft && selectedZoneId ? layoutDraft.zones[selectedZoneId] : null;

  useEffect(() => {
    setConfirmingDelete(false);
  }, [selectedZoneId]);

  if (!zone) {
    return <PlaceholderContent description="Zone context is unavailable for the current selection." />;
  }

  return (
    <div className="px-3 py-3">
      <div className="rounded-xl border border-[var(--border-muted)] bg-white p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900" title={zone.name}>
              {zone.name}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {zone.code} | {formatZoneCategory(zone.category)}
            </div>
          </div>

          <span
            className="inline-flex h-6 w-6 shrink-0 rounded-full border border-white shadow-sm"
            style={{ background: zone.color }}
            title={zone.color}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            { label: 'Size', value: `${Math.round(zone.width)} x ${Math.round(zone.height)}` },
            { label: 'Origin', value: `${Math.round(zone.x)}, ${Math.round(zone.y)}` }
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-2.5 py-2"
            >
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {label}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-slate-800">{value}</div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          Rename, recolor, and fine-tune geometry in the inspector.
        </p>
      </div>

      <div className="mt-3 grid gap-2">
        <ContextActionButton
          label="Inspect zone"
          icon={SlidersHorizontal}
          onClick={onOpenInspector}
        />

        {isLayoutEditable && (
          !confirmingDelete ? (
            <ContextActionButton
              label="Delete zone"
              icon={Trash2}
              variant="danger"
              onClick={() => setConfirmingDelete(true)}
            />
          ) : (
            <div className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-red-200 bg-red-50 p-2">
              <div className="self-center px-1 text-[11px] font-medium text-red-600">
                Delete this zone?
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-lg border border-[var(--border-muted)] bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteZone(zone.id);
                    setConfirmingDelete(false);
                  }}
                  className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function StorageContainerContextPanel({
  workspace
}: {
  workspace: FloorWorkspace | null;
}) {
  const selection = useEditorSelection();
  const startPlacementMove = useStartPlacementMove();
  const { data: publishedCells = [] } = usePublishedCells(workspace?.floorId ?? null);

  if (selection.type !== 'container') {
    return <PlaceholderContent description="Container context is unavailable for the current selection." />;
  }

  const sourceCellId = selection.sourceCellId ?? null;
  const sourceCell =
    sourceCellId !== null ? (publishedCells.find((cell) => cell.id === sourceCellId) ?? null) : null;

  return (
    <div className="px-3 py-3">
      <div className="rounded-xl border border-[var(--border-muted)] bg-white p-3">
        <div className="text-sm font-semibold text-slate-900">Container</div>
        <div
          className="mt-1 truncate font-mono text-xs font-semibold text-slate-700"
          title={selection.containerId}
        >
          {selection.containerId}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          {sourceCellId
            ? `Placed in ${sourceCell?.address.raw ?? sourceCellId}.`
            : 'No source cell is attached to this container selection.'}{' '}
          Full container identity and inventory stay in the inspector.
        </p>
      </div>

      <ContextActionButton
        label="Move"
        icon={MoveRight}
        className="mt-3 w-full"
        disabled={!sourceCellId}
        onClick={() => {
          if (!sourceCellId) return;
          startPlacementMove(selection.containerId, sourceCellId);
        }}
      />
    </div>
  );
}

function IdleContextPanel({
  viewMode,
  workspace,
  onAddRack,
  onDrawZone
}: {
  viewMode: 'view' | 'storage' | 'layout';
  workspace: FloorWorkspace | null;
  onAddRack: () => void;
  onDrawZone: () => void;
}) {
  const isLayoutEditable = useIsLayoutEditable();
  const isPublishedOnly = Boolean(workspace?.latestPublished && !workspace?.activeDraft);

  const idleConfig = {
    view: {
      icon: Eye,
      title: 'Browse warehouse',
      summary: 'Read-only mode',
      detail: 'Zoom to rack or cell level, then select a rack, cell, or container to inspect.',
      footer: 'Selection details appear in the right inspector.'
    },
    storage: {
      icon: Package,
      title: 'Storage mode',
      summary: 'No cell selected',
      detail: 'Select a cell at L3 to review occupancy and launch Place or Move actions.',
      footer: 'Current action context appears here after selection.'
    },
    layout: {
      icon: isPublishedOnly ? Lock : MousePointer2,
      title: isPublishedOnly ? 'Published layout' : 'Layout mode',
      summary: isPublishedOnly ? 'Read-only structure' : 'No rack selected',
      detail: isPublishedOnly
        ? 'Create a draft to edit rack geometry. Published structure remains inspectable.'
        : 'Select a rack, zone, or wall to inspect geometry, or draw a new object.',
      footer: 'Rack, rack-side, zone, and wall context appear here after selection.'
    }
  }[viewMode];

  const Icon = idleConfig.icon;

  return (
    <div className="px-3 py-3">
      <div className="rounded-xl border border-[var(--border-muted)] bg-white p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-secondary)]">
            <Icon className="h-4 w-4 text-slate-500" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">
              {idleConfig.title}
            </div>
            <div className="text-[11px] text-slate-500">
              {idleConfig.summary}
            </div>
          </div>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          {idleConfig.detail}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          {idleConfig.footer}
        </p>
      </div>

      {viewMode === 'layout' && isLayoutEditable && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <ContextActionButton
            label="Add rack"
            icon={PlusCircle}
            onClick={onAddRack}
          />
          <ContextActionButton
            label="Draw zone"
            icon={MapPin}
            onClick={onDrawZone}
          />
        </div>
      )}
    </div>
  );
}

function ContextActionButton({
  icon: Icon,
  label,
  onClick,
  variant = 'default',
  className = '',
  disabled = false
}: {
  icon: typeof RotateCcw;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  className?: string;
  disabled?: boolean;
}) {
  const buttonClassName =
    variant === 'danger'
      ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
      : 'border-[var(--border-muted)] bg-white text-slate-600 hover:bg-slate-50';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${buttonClassName} ${className}`.trim()}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function PlaceholderContent({ description }: { description: string }) {
  return (
    <div className="px-3 py-3">
      <p
        className="text-xs leading-relaxed"
        style={{ color: 'var(--text-muted)' }}
      >
        {description}
      </p>
    </div>
  );
}

// ─── component ───────────────────────────────────────────────────────────────

/**
 * ContextPanel shell.
 *
 * Reads scope, selection, mode from the store and resolves whether to show
 * and what intent to display. Renders as an absolute overlay inside the
 * canvas container.
 *
 * Layout position: right side of the canvas area, vertically offset from top.
 * Coexists with the right inspector — both can be visible simultaneously because
 * this panel is inside the canvas flex child which shrinks when inspector opens.
 */
export function ContextPanel({
  workspace,
  onAddRack,
  onDrawZone,
  onOpenInspector
}: {
  workspace: FloorWorkspace | null;
  onAddRack: () => void;
  onDrawZone: () => void;
  onOpenInspector: () => void;
}) {
  const scope = useInteractionScope();
  const editorMode = useEditorMode();
  const viewMode = useViewMode();
  const selection = useEditorSelection();
  const contextPanelMode = useContextPanelMode();
  const toggleContextPanelMode = useToggleContextPanelMode();

  const intent = resolveContextPanelIntent({ scope, editorMode, viewMode, selection });

  if (intent === 'hidden') return null;

  const config = INTENT_CONFIG[intent];
  const Icon = config.icon;
  const isExpanded = contextPanelMode === 'expanded';
  const shellClassName = `pointer-events-auto absolute right-4 top-4 z-20 flex max-h-[calc(100%-32px)] flex-col overflow-hidden rounded-2xl transition-all duration-200 ${
    isExpanded
      ? 'w-[min(420px,calc(100%-32px))]'
      : 'w-[min(264px,calc(100%-32px))]'
  }`;
  const ModeIcon = isExpanded ? Minimize2 : Maximize2;
  const modeToggleTitle = isExpanded
    ? 'Collapse context panel'
    : 'Expand context panel';

  return (
    <div
      role="complementary"
      aria-label="Context panel"
      className={shellClassName}
      style={{
        background: 'var(--surface-primary)',
        border: '1px solid var(--border-muted)',
        boxShadow: 'var(--shadow-panel)'
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 border-b px-3 py-2.5"
        style={{ borderColor: 'var(--border-muted)' }}
      >
        <Icon
          className="h-3.5 w-3.5 shrink-0"
          style={{ color: 'var(--accent)' }}
        />
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-primary)' }}
        >
          {config.label}
        </span>
        <button
          type="button"
          onClick={toggleContextPanelMode}
          title={modeToggleTitle}
          aria-label={modeToggleTitle}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-slate-100"
          style={{ color: 'var(--text-muted)' }}
        >
          <ModeIcon className="h-3.5 w-3.5" />
        </button>
        <span
          className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
          style={{
            background: 'var(--accent-soft)',
            color: 'var(--accent)'
          }}
        >
          {viewMode}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {intent === 'rack-context' && viewMode === 'layout' && (
          <RackContextPanel workspace={workspace} />
        )}
        {intent === 'rack-side-context' && viewMode === 'layout' && (
          <RackSideContextPanel workspace={workspace} />
        )}
        {intent === 'zone-context' && viewMode === 'layout' && (
          <ZoneContextPanel
            workspace={workspace}
            onOpenInspector={onOpenInspector}
          />
        )}
        {intent === 'wall-context' && viewMode === 'layout' && (
          <WallContextPanel
            workspace={workspace}
            onOpenInspector={onOpenInspector}
          />
        )}
        {intent === 'cell-context' && viewMode === 'storage' && (
          <StorageCellContextPanel
            workspace={workspace}
            panelMode={contextPanelMode}
          />
        )}
        {intent === 'container-context' && viewMode === 'storage' && (
          <StorageContainerContextPanel workspace={workspace} />
        )}
        {intent === 'workflow' && viewMode === 'storage' && (
          <StorageWorkflowContextPanel
            workspace={workspace}
            panelMode={contextPanelMode}
          />
        )}
        {intent === 'idle-view' && (
          <IdleContextPanel
            viewMode="view"
            workspace={workspace}
            onAddRack={onAddRack}
            onDrawZone={onDrawZone}
          />
        )}
        {intent === 'idle-storage' && (
          <IdleContextPanel
            viewMode="storage"
            workspace={workspace}
            onAddRack={onAddRack}
            onDrawZone={onDrawZone}
          />
        )}
        {intent === 'idle-layout' && (
          <IdleContextPanel
            viewMode="layout"
            workspace={workspace}
            onAddRack={onAddRack}
            onDrawZone={onDrawZone}
          />
        )}
        {((intent === 'rack-context' && viewMode !== 'layout') ||
          (intent === 'rack-side-context' && viewMode !== 'layout') ||
          (intent === 'zone-context' && viewMode !== 'layout') ||
          (intent === 'wall-context' && viewMode !== 'layout') ||
          (intent === 'cell-context' && viewMode !== 'storage') ||
          (intent === 'container-context' && viewMode !== 'storage') ||
          (intent === 'workflow' && viewMode !== 'storage') ||
          (intent !== 'rack-context' &&
            intent !== 'rack-side-context' &&
            intent !== 'zone-context' &&
            intent !== 'wall-context' &&
            intent !== 'cell-context' &&
            intent !== 'container-context' &&
            intent !== 'idle-view' &&
            intent !== 'idle-storage' &&
            intent !== 'idle-layout' &&
            intent !== 'workflow')) && (
          <PlaceholderContent description={config.description} />
        )}
      </div>
    </div>
  );
}
