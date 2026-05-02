import { Minus, Menu, MousePointer2, PlusSquare, Square } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Divider } from '@/shared/ui/divider';
import { IconButton } from '@/shared/ui/icon-button';
import { ToolRail as ShellToolRail } from '@/shared/ui/tool-rail';
import { useToggleDrawer } from '@/app/store/ui-selectors';
import {
  useClearSelection,
  useEditorMode,
  useIsLayoutEditable,
  useLayoutDraftState,
  useSetEditorMode,
  useViewMode
} from '@/warehouse/editor/model/editor-selectors';
import type { EditorMode, ViewMode } from '@/warehouse/editor/model/editor-types';

type Tool = {
  id: string;
  icon: LucideIcon;
  label: string;
  editorMode?: EditorMode;
  disabled?: boolean;
};

const TOOLS_BY_VIEW: Record<ViewMode, Tool[]> = {
  view: [
    { id: 'select', icon: MousePointer2, label: 'Select', editorMode: 'select' }
  ],
  storage: [
    { id: 'select', icon: MousePointer2, label: 'Select', editorMode: 'select' }
  ],
  layout: [
    { id: 'select', icon: MousePointer2, label: 'Select', editorMode: 'select' },
    { id: 'rack', icon: PlusSquare, label: 'Add Rack', editorMode: 'place' },
    { id: 'zone', icon: Square, label: 'Draw Zone', editorMode: 'draw-zone' },
    { id: 'wall', icon: Minus, label: 'Draw Wall', editorMode: 'draw-wall' }
  ]
};

const MODE_LABELS: Record<ViewMode, string> = {
  view: 'View',
  storage: 'Storage',
  layout: 'Layout'
};

export function ToolRail() {
  const viewMode = useViewMode();
  const clearSelection = useClearSelection();
  const editorMode = useEditorMode();
  const setEditorMode = useSetEditorMode();
  const layoutDraft = useLayoutDraftState();
  const isLayoutEditable = useIsLayoutEditable();
  const hasLayout = !!layoutDraft;
  const toggleDrawer = useToggleDrawer();

  const tools = TOOLS_BY_VIEW[viewMode] ?? TOOLS_BY_VIEW.layout;

  const activeToolId =
    editorMode === 'place'
      ? 'rack'
      : editorMode === 'draw-zone'
        ? 'zone'
        : editorMode === 'draw-wall'
          ? 'wall'
          : 'select';

  return (
    <ShellToolRail
      orientation="vertical"
      className="h-full w-12 shrink-0 rounded-none border-y-0 border-l-0 bg-transparent p-2"
      style={{
        background: 'var(--surface-primary)',
        borderColor: 'var(--border-muted)'
      }}
    >
      <div className="flex flex-col items-center gap-1">
        <IconButton
          icon={<Menu className="h-4 w-4" />}
          title="Navigation menu"
          onClick={toggleDrawer}
          className="group relative h-9 w-9 rounded-lg transition-all"
          style={{ color: 'var(--text-muted)' }}
        />

        <Divider className="my-1 w-5" style={{ background: 'var(--border-muted)' }} />

        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = tool.id === activeToolId;
          const isDisabled =
            !hasLayout ||
            tool.disabled ||
            (tool.editorMode !== 'select' && !isLayoutEditable);

          return (
            <IconButton
              key={tool.id}
              icon={<Icon className="h-4 w-4" />}
              title={tool.label}
              disabled={isDisabled}
              onClick={() => {
                if (!tool.editorMode) return;
                if (tool.editorMode !== 'select') {
                  clearSelection();
                }
                setEditorMode(tool.editorMode);
              }}
              className="group relative h-9 w-9 rounded-lg transition-all disabled:opacity-30"
              style={
                isActive
                  ? {
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)'
                    }
                  : {
                      color: 'var(--text-muted)'
                    }
              }
            >
              {/* Tooltip */}
              <span
                className="pointer-events-none absolute left-full ml-2 z-50 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium opacity-0 shadow-md transition-opacity group-hover:opacity-100"
                style={{
                  background: 'var(--text-primary)',
                  color: '#fff'
                }}
              >
                {tool.label}
              </span>

              {/* Active indicator */}
              {isActive && (
                <span
                  className="absolute -right-px top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full"
                  style={{ background: 'var(--accent)' }}
                />
              )}
            </IconButton>
          );
        })}
      </div>

      {/* View mode label at bottom */}
      <div className="mt-auto pb-1">
        <span
          className="block text-center text-[9px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--border-strong)', writingMode: 'vertical-rl' }}
        >
          {MODE_LABELS[viewMode]}
        </span>
      </div>
    </ShellToolRail>
  );
}
