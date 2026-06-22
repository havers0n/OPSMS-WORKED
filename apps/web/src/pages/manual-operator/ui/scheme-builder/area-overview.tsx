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
  if (areas.length === 0) {
    return (
      <div className="bg-white border border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-500 text-sm">
        אין אזורי הפצה בנתוני המשמרת
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-bold text-gray-700">איזור הפצה</label>
      <div className="flex flex-wrap gap-2">
        {areas.map((area) => {
          const isSelected = selectedAreaName === (area.areaName ?? '__null__');
          return (
            <button
              key={area.areaName ?? '__null__'}
              type="button"
              onClick={() => onSelectArea(area.areaName)}
              className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors text-right ${
                isSelected
                  ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-sm'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-bold">{area.displayName}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {area.totalOrders} הזמנות &middot; כמות {area.totalQuantity}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
