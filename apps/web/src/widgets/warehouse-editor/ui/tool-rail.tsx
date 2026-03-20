import { Menu, MousePointer2, PlusSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useToggleDrawer } from '@/app/store/ui-selectors';
import {
  useEditorMode,
  useIsLayoutEditable,
  useLayoutDraftState,
  useSetEditorMode,
  useViewMode
} from '@/entities/layout-version/model/editor-selectors';
import type { ViewMode } from '@/entities/layout-version/model/editor-types';

type Tool = {
  id: string;
  icon: LucideIcon;
  label: string;
  editorMode?: 'select' | 'place';
  disabled?: boolean;
};

const TOOLS_BY_VIEW: Record<ViewMode, Tool[]> = {
  layout: [
    { id: 'select', icon: MousePointer2, label: 'Select', editorMode: 'select' },
    { id: 'rack', icon: PlusSquare, label: 'Add Rack', editorMode: 'place' }
  ],
  placement: [
    { id: 'select', icon: MousePointer2, label: 'Select', editorMode: 'select' }
  ]
};

export function ToolRail() {
  const viewMode = useViewMode();
  const editorMode = useEditorMode();
  const setEditorMode = useSetEditorMode();
  const layoutDraft = useLayoutDraftState();
  const isLayoutEditable = useIsLayoutEditable();
  const hasLayout = !!layoutDraft;
  const toggleDrawer = useToggleDrawer();

  const tools = TOOLS_BY_VIEW[viewMode] ?? TOOLS_BY_VIEW.layout;

  const activeToolId = editorMode === 'place' ? 'rack' : 'select';

  return (
    <aside
      className="flex w-12 shrink-0 flex-col items-center border-r py-2"
      style={{
        background: 'var(--surface-primary)',
        borderColor: 'var(--border-muted)'
      }}
    >
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          title="Navigation menu"
          onClick={toggleDrawer}
          className="group relative flex h-9 w-9 flex-col items-center justify-center rounded-lg transition-all"
          style={{ color: 'var(--text-muted)' }}
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="my-1 w-5 border-t" style={{ borderColor: 'var(--border-muted)' }} />

        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = tool.id === activeToolId;
          const isDisabled =
            !hasLayout ||
            tool.disabled ||
            (tool.editorMode === 'place' && !isLayoutEditable);

          return (
            <button
              key={tool.id}
              type="button"
              title={tool.label}
              disabled={isDisabled}
              onClick={() => {
                if (tool.editorMode) setEditorMode(tool.editorMode);
              }}
              className="group relative flex h-9 w-9 flex-col items-center justify-center rounded-lg transition-all disabled:cursor-not-allowed disabled:opacity-30"
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
              <Icon className="h-4 w-4" />

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
            </button>
          );
        })}
      </div>

      {/* View mode label at bottom */}
      <div className="mt-auto pb-1">
        <span
          className="block text-center text-[9px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--border-strong)', writingMode: 'vertical-rl' }}
        >
          {viewMode === 'placement' ? 'Storage' : viewMode}
        </span>
      </div>
    </aside>
  );
}
