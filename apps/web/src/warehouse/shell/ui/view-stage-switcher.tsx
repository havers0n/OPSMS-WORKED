import { Map, Route } from 'lucide-react';
import {
  useSetViewStage,
  useViewStage
} from '@/widgets/warehouse-editor/model/editor-selectors';
import type { ViewStage } from '@/widgets/warehouse-editor/model/editor-types';

const VIEW_STAGES: Array<{
  id: ViewStage;
  label: string;
  icon: typeof Map;
}> = [
  { id: 'map', label: 'Map', icon: Map },
  { id: 'picking-plan', label: 'Picking plan', icon: Route }
];

export function ViewStageSwitcher() {
  const viewStage = useViewStage();
  const setViewStage = useSetViewStage();

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg p-0.5"
      style={{
        background: 'color-mix(in srgb, var(--surface-secondary) 72%, transparent)',
        border: '1px solid var(--border-muted)'
      }}
    >
      {VIEW_STAGES.map((stage) => {
        const Icon = stage.icon;
        const isActive = viewStage === stage.id;

        return (
          <button
            key={stage.id}
            type="button"
            onClick={() => setViewStage(stage.id)}
            aria-pressed={isActive}
            title={stage.label}
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
            {stage.label}
          </button>
        );
      })}
    </div>
  );
}
