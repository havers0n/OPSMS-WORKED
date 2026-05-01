import { useSetViewMode, useViewMode } from '@/widgets/warehouse-editor/model/editor-selectors';
import type { ViewMode } from '@/widgets/warehouse-editor/model/editor-types';
import { Button } from '@/shared/ui/button';
import { ViewStageSwitcher } from './view-stage-switcher';

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: 'view', label: 'View' },
  { id: 'storage', label: 'Storage' },
  { id: 'layout', label: 'Layout' },
];

export function ViewModeSwitcher() {
  const viewMode = useViewMode();
  const setViewMode = useSetViewMode();

  return (
    <div className="flex flex-1 items-center justify-center gap-2 px-4">
      <div
        className="flex items-center gap-0.5 rounded-lg p-0.5"
        style={{ background: 'var(--surface-secondary)', border: '1px solid var(--border-muted)' }}
      >
        {VIEW_MODES.map((mode) => {
          const isActive = viewMode === mode.id;
          return (
            <Button
              key={mode.id}
              variant="ghost"
              size="sm"
              onClick={() => setViewMode(mode.id)}
              className="h-auto rounded-md px-3 py-1 text-xs font-medium transition-all hover:bg-transparent"
              aria-pressed={isActive}
              style={
                isActive
                  ? {
                      background: 'var(--surface-strong)',
                      color: 'var(--accent)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                      cursor: 'default'
                    }
                  : { color: 'var(--text-muted)', cursor: 'pointer' }
              }
            >
              {mode.label}
            </Button>
          );
        })}
      </div>
      {viewMode === 'view' && <ViewStageSwitcher />}
    </div>
  );
}
