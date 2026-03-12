import { MousePointer2, PlusSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  useEditorMode,
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
    { id: 'rack', icon: PlusSquare, label: 'Rack', editorMode: 'place' }
  ],
  semantics: [
    { id: 'select', icon: MousePointer2, label: 'Select', editorMode: 'select' }
  ],
  placement: [
    { id: 'select', icon: MousePointer2, label: 'Select', editorMode: 'select' }
  ],
  flow: [
    { id: 'select', icon: MousePointer2, label: 'Select', editorMode: 'select' }
  ]
};

export function ToolRail() {
  const viewMode = useViewMode();
  const editorMode = useEditorMode();
  const setEditorMode = useSetEditorMode();
  const layoutDraft = useLayoutDraftState();
  const hasDraft = !!layoutDraft;

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
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = tool.id === activeToolId;
          const isDisabled = !hasDraft || tool.disabled;

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
          {viewMode}
        </span>
      </div>
    </aside>
  );
}
