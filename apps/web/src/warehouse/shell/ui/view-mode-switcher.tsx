import {
  useSetWarehouseViewMode,
  useWarehouseViewMode,
  type WarehouseViewMode
} from '@/warehouse/state/view-mode';
import { Button } from '@/shared/ui/button';
import { useT } from '@/shared/i18n';
import { ViewStageSwitcher } from './view-stage-switcher';

const VIEW_MODES: { id: WarehouseViewMode; labelKey: 'warehouse.view.mode.view' | 'warehouse.view.mode.storage' }[] = [
  { id: 'view', labelKey: 'warehouse.view.mode.view' },
  { id: 'storage', labelKey: 'warehouse.view.mode.storage' },
];

export function ViewModeSwitcher() {
  const t = useT();
  const viewMode = useWarehouseViewMode();
  const setViewMode = useSetWarehouseViewMode();

  return (
    <div className="flex flex-1 items-center justify-center gap-2">
      <div
        className="flex h-9 items-center gap-1 rounded-md border bg-white p-1 shadow-sm"
        style={{ borderColor: 'var(--border-muted)' }}
      >
        {VIEW_MODES.map((mode) => {
          const isActive = viewMode === mode.id;
          return (
            <Button
              key={mode.id}
              variant="ghost"
              size="sm"
              onClick={() => setViewMode(mode.id)}
              className="relative h-7 rounded px-2 text-xs font-medium transition-colors hover:bg-slate-50 md:px-3 md:text-sm"
              aria-pressed={isActive}
              style={
                isActive
                  ? {
                      background: 'var(--surface-secondary)',
                      color: 'var(--accent)',
                      cursor: 'default'
                    }
                  : { color: 'var(--text-muted)', cursor: 'pointer' }
              }
            >
              {t(mode.labelKey)}
            </Button>
          );
        })}
      </div>
      {viewMode === 'view' && <ViewStageSwitcher />}
    </div>
  );
}
