import type { SourceArea } from './scheme-types';

export function AreaOverview({
  areas,
  selectedAreaName,
  onSelectArea,
}: {
  areas: SourceArea[];
  selectedAreaName: string | null;
  onSelectArea: (areaName: string | null) => void;
}) {
  if (areas.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto">
      {areas.map((area) => {
        const isSelected = selectedAreaName === (area.areaName ?? '__null__');
        return (
          <button
            key={area.areaName ?? '__null__'}
            type="button"
            onClick={() => onSelectArea(area.areaName)}
            className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
              isSelected
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {area.displayName}
            <span className="me-1 text-[10px] opacity-70">({area.totalOrders})</span>
          </button>
        );
      })}
    </div>
  );
}
