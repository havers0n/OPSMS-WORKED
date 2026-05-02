/**
 * ContextPanel — a focused temporary workspace surface.
 *
 * Sits between the local bar (compact launcher) and the right inspector
 * (persistent truth surface). It shows the current interaction context:
 * object summary, next-step actions, workflow state.
 */
import type { FloorWorkspace } from '@wos/domain';
import {
  ArrowRightLeft,
  Box,
  Info,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Package
} from 'lucide-react';
import {
  useContextPanelMode,
  useEditorMode,
  useEditorSelection,
  useInteractionScope,
  useToggleContextPanelMode,
  useViewMode
} from '@/warehouse/editor/model/editor-selectors';
import { resolveContextPanelIntent, type ContextPanelIntent } from './context-panel-logic';
import { LayoutContextPanel } from './context-panel/layout-context-panel';
import { StorageContextPanel } from './context-panel/storage-context-panel';

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
  workflow: {
    icon: ArrowRightLeft,
    label: 'Workflow active',
    description: 'Workflow state and progress will appear here.'
  }
};

function shouldRenderFallback(
  intent: ContextPanelIntent,
  viewMode: 'layout' | 'view' | 'storage'
) {
  return ((intent === 'rack-side-context' && viewMode !== 'layout') ||
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
      intent !== 'workflow'));
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

export function ContextPanel({
  workspace,
  onOpenInspector
}: {
  workspace: FloorWorkspace | null;
  onOpenInspector: () => void;
}) {
  const scope = useInteractionScope();
  const editorMode = useEditorMode();
  const viewMode = useViewMode();
  const selection = useEditorSelection();
  const contextPanelMode = useContextPanelMode();
  const toggleContextPanelMode = useToggleContextPanelMode();

  const intent = resolveContextPanelIntent({ scope, editorMode, viewMode, selection });
  const hideLayoutRackContext = intent === 'rack-context' && viewMode === 'layout';

  if (intent === 'hidden' || hideLayoutRackContext) return null;

  const config = INTENT_CONFIG[intent];
  const showExpandToggle = intent === 'cell-context' || intent === 'workflow';
  const isExpanded = showExpandToggle && contextPanelMode === 'expanded';
  const shellClassName = `pointer-events-auto absolute right-4 top-4 z-20 flex max-h-[calc(100%-32px)] flex-col overflow-hidden rounded-2xl transition-all duration-200 ${
    isExpanded
      ? 'w-[min(420px,calc(100%-32px))]'
      : 'w-[min(280px,calc(100%-32px))]'
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
      {showExpandToggle && (
        <div
          className="flex items-center justify-end border-b px-2 py-1.5"
          style={{ borderColor: 'var(--border-muted)' }}
        >
          <button
            type="button"
            onClick={toggleContextPanelMode}
            title={modeToggleTitle}
            aria-label={modeToggleTitle}
            className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-slate-100"
            style={{ color: 'var(--text-muted)' }}
          >
            <ModeIcon className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <LayoutContextPanel
          workspace={workspace}
          onOpenInspector={onOpenInspector}
          intent={intent}
          viewMode={viewMode}
        />
        <StorageContextPanel
          workspace={workspace}
          intent={intent}
          viewMode={viewMode}
          panelMode={contextPanelMode}
        />
        {shouldRenderFallback(intent, viewMode) && (
          <PlaceholderContent description={config.description} />
        )}
      </div>
    </div>
  );
}
