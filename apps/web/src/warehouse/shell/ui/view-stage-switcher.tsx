import { useEffect } from 'react';
import { Map, Route } from 'lucide-react';
import {
  useSetWarehouseViewStage,
  useWarehouseViewStage,
  type WarehouseViewStage
} from '@/warehouse/state/view-mode';
import { useT } from '@/shared/i18n';

const VIEW_STAGES: Array<{
  id: WarehouseViewStage;
  labelKey: 'warehouse.view.stage.map' | 'warehouse.view.stage.pickingPlan';
  icon: typeof Map;
}> = [
  { id: 'map', labelKey: 'warehouse.view.stage.map', icon: Map },
  { id: 'picking-plan', labelKey: 'warehouse.view.stage.pickingPlan', icon: Route }
];

export function ViewStageSwitcher() {
  const t = useT();
  const viewStage = useWarehouseViewStage();
  const setViewStage = useSetWarehouseViewStage();
  const visibleStages = VIEW_STAGES;

  useEffect(() => {
    if (visibleStages.some((stage) => stage.id === viewStage)) return;
    setViewStage('map');
  }, [setViewStage, viewStage, visibleStages]);

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg p-0.5"
      style={{
        background: 'color-mix(in srgb, var(--surface-secondary) 72%, transparent)',
        border: '1px solid var(--border-muted)'
      }}
    >
      {visibleStages.map((stage) => {
        const Icon = stage.icon;
        const isActive = viewStage === stage.id;

        return (
          <button
            key={stage.id}
            type="button"
            onClick={() => setViewStage(stage.id)}
            aria-pressed={isActive}
            title={t(stage.labelKey)}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors"
            style={
              isActive
                ? {
                    background: 'var(--surface-strong)',
                    color: 'var(--accent)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
                  }
                : { color: 'var(--text-muted)' }
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {t(stage.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
