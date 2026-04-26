import { useMemo, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Maximize2,
  Minimize2,
  PackageCheck,
  Route,
  Split,
  Workflow
} from 'lucide-react';

type PickingPriority = {
  id: string;
  label: string;
  detail: string;
};

const PIPELINE_STEPS = [
  { label: 'Wave', icon: PackageCheck },
  { label: 'Strategy', icon: Workflow },
  { label: 'Split', icon: Split },
  { label: 'Route', icon: Route }
];

const DEFAULT_PRIORITIES: PickingPriority[] = [
  {
    id: 'zone',
    label: 'Zone',
    detail: 'Group work by operational zone first.'
  },
  {
    id: 'aisle',
    label: 'Aisle',
    detail: 'Keep walking path contiguous inside a zone.'
  },
  {
    id: 'route-sequence',
    label: 'Route sequence',
    detail: 'Use explicit location route ordering.'
  },
  {
    id: 'position',
    label: 'Aisle position',
    detail: 'Walk from lower to higher aisle position.'
  },
  {
    id: 'handling',
    label: 'Handling',
    detail: 'Protect heavy, bulky, fragile, cold and hazmat constraints.'
  }
];

function movePriority(
  priorities: PickingPriority[],
  index: number,
  direction: -1 | 1
) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= priorities.length) return priorities;

  const next = [...priorities];
  const current = next[index];
  const target = next[nextIndex];
  if (!current || !target) return priorities;

  next[index] = target;
  next[nextIndex] = current;
  return next;
}

function PipelineMap() {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-center gap-2">
      {PIPELINE_STEPS.map((step, index) => {
        const Icon = step.icon;

        return (
          <div key={step.label} className="contents">
            <div
              className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-center"
              style={{
                background: 'rgba(255,255,255,0.74)',
                borderColor: 'rgba(148,163,184,0.45)',
                color: 'var(--text-primary)'
              }}
            >
              <Icon className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              <span className="text-[11px] font-semibold">{step.label}</span>
            </div>
            {index < PIPELINE_STEPS.length - 1 && (
              <ArrowRight
                className="h-4 w-4"
                style={{ color: 'rgba(37,99,235,0.82)' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PickingPlanningOverlay() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [priorities, setPriorities] = useState(DEFAULT_PRIORITIES);

  const routeSummary = useMemo(
    () => priorities.map((priority) => priority.label).join(' > '),
    [priorities]
  );

  if (isCollapsed) {
    return (
      <div className="pointer-events-none absolute left-4 top-4 z-30">
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          data-testid="picking-planning-overlay-expand"
          className="pointer-events-auto inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold shadow-md backdrop-blur"
          style={{
            background: 'rgba(255,255,255,0.9)',
            borderColor: 'rgba(37,99,235,0.42)',
            color: 'var(--accent)'
          }}
        >
          <Maximize2 className="h-3.5 w-3.5" />
          Picking plan
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute left-4 top-4 z-30 w-[min(560px,calc(100%-32px))]">
      <section
        data-testid="picking-planning-overlay"
        className="pointer-events-auto rounded-xl border p-3 shadow-[0_16px_40px_rgba(15,23,42,0.18)] backdrop-blur-md"
        style={{
          background: 'rgba(248,250,252,0.88)',
          borderColor: 'rgba(37,99,235,0.36)'
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div
              className="text-[11px] font-semibold uppercase"
              style={{ color: 'var(--accent)' }}
            >
              View / Picking plan
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-800">
              Read-only planning path
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            title="Collapse picking plan"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/70 hover:text-slate-700"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-3">
          <PipelineMap />
        </div>

        <div
          className="mt-3 rounded-lg border px-3 py-2 text-[11px]"
          style={{
            background: 'rgba(239,246,255,0.72)',
            borderColor: 'rgba(37,99,235,0.22)',
            color: '#334155'
          }}
        >
          <span className="font-semibold text-slate-700">Picking order:</span>{' '}
          {routeSummary}
        </div>

        <div className="mt-3 space-y-1.5">
          {priorities.map((priority, index) => (
            <div
              key={priority.id}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg border px-2 py-2"
              style={{
                background: 'rgba(255,255,255,0.72)',
                borderColor: 'rgba(148,163,184,0.35)'
              }}
            >
              <GripVertical className="h-4 w-4 text-slate-400" />
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-slate-800">
                  {index + 1}. {priority.label}
                </div>
                <div className="truncate text-[11px] text-slate-500">
                  {priority.detail}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setPriorities((current) => movePriority(current, index, -1))
                  }
                  disabled={index === 0}
                  title={`Move ${priority.label} up`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPriorities((current) => movePriority(current, index, 1))
                  }
                  disabled={index === priorities.length - 1}
                  title={`Move ${priority.label} down`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
