import type { AreaHierarchySummary } from '@/entities/manual-shift/model/shift-selectors';

interface ManualWorkAreaFiltersProps {
  areas: AreaHierarchySummary[];
  selectedAreaKey: string | null;
  onSelectArea: (areaKey: string | null) => void;
}

export function ManualWorkAreaFilters({
  areas,
  selectedAreaKey,
  onSelectArea
}: ManualWorkAreaFiltersProps) {
  if (areas.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="manual-work-filters">
      <span className="text-xs font-semibold text-gray-500">מסנני עבודה</span>
      <button
        type="button"
        onClick={() => onSelectArea(null)}
        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
          selectedAreaKey === null
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
        }`}
        data-testid="manual-work-filter-all"
      >
        הכל
      </button>
      {areas.map((area) => {
        const isActive = area.areaKey === selectedAreaKey;

        return (
          <button
            key={area.areaKey}
            type="button"
            onClick={() => onSelectArea(area.areaKey)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              isActive
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
            data-testid={`manual-work-filter-${area.areaKey}`}
          >
            {area.displayName}
          </button>
        );
      })}
    </div>
  );
}
