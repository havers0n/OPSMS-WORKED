import type { FloorWorkspace } from '@wos/domain';
import { MoveRight, Package, RotateCcw } from 'lucide-react';
import type { ViewMode, ContextPanelMode } from '@/widgets/warehouse-editor/model/editor-types';
import {
  useStorageSelection,
  useStorageStartPlacementMove
} from '@/widgets/warehouse-editor/model/storage-ui-facade';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import type { ContextPanelIntent } from '../context-panel-logic';
import { StorageCellContextPanel } from '../mode-panels/storage-cell-context-panel';
import { StorageWorkflowContextPanel } from '../mode-panels/storage-workflow-context-panel';

function StorageContainerContextPanel({
  workspace
}: {
  workspace: FloorWorkspace | null;
}) {
  const selection = useStorageSelection();
  const startPlacementMove = useStorageStartPlacementMove();
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

export function StorageContextPanel({
  workspace,
  intent,
  viewMode,
  panelMode
}: {
  workspace: FloorWorkspace | null;
  intent: ContextPanelIntent;
  viewMode: ViewMode;
  panelMode: ContextPanelMode;
}) {
  if (intent === 'cell-context' && viewMode === 'storage') {
    return (
      <StorageCellContextPanel
        workspace={workspace}
        panelMode={panelMode}
      />
    );
  }

  if (intent === 'container-context' && viewMode === 'storage') {
    return <StorageContainerContextPanel workspace={workspace} />;
  }

  if (intent === 'workflow' && viewMode === 'storage') {
    return (
      <StorageWorkflowContextPanel
        workspace={workspace}
        panelMode={panelMode}
      />
    );
  }

  return null;
}
