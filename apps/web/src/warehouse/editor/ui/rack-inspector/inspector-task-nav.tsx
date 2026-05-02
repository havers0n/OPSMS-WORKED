import type { ObjectWorkContext } from '@/warehouse/editor/model/editor-types';

const TASK_OPTIONS: Array<{ value: ObjectWorkContext; label: string }> = [
  { value: 'geometry', label: 'Geometry' },
  { value: 'structure', label: 'Structure' },
  { value: 'addressing', label: 'Addressing' }
];

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export function InspectorTaskNav({
  value,
  onChange
}: {
  value: ObjectWorkContext;
  onChange: (next: ObjectWorkContext) => void;
}) {
  return (
    <div
      data-testid="rack-inspector-task-nav"
      className="mt-2 flex rounded-xl border border-[var(--border-muted)] bg-white p-0.5 shadow-sm"
    >
      {TASK_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          data-testid={`rack-inspector-task-${option.value}`}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            value === option.value
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
