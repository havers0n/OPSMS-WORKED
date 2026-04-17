import { OccupancyBar } from '@/entities/location/ui/occupancy-bar';

export interface RackStatusSummaryProps {
  displayCode: string;
  kind: string;
  axis: string;
  occupancySummary: {
    occupancyRate: number;
    occupiedCells: number;
    totalCells: number;
  };
  levels: Array<{
    levelOrdinal: number;
    occupiedCells: number;
    totalCells: number;
  }>;
}

export function RackStatusSummary({
  displayCode,
  kind,
  axis,
  occupancySummary,
  levels
}: RackStatusSummaryProps) {
  return (
    <div role="complementary" aria-label={`Rack overview: ${displayCode}`}>
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="font-mono font-semibold text-gray-900">{displayCode}</span>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="capitalize">{kind}</span>
            <span className="text-gray-300">·</span>
            <span>{axis}</span>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-gray-200 space-y-2">
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 -mx-4 -my-3 mb-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Occupancy</h3>
        </div>
        <OccupancyBar rate={occupancySummary.occupancyRate} />
        <div className="text-xs text-gray-500">
          {occupancySummary.occupiedCells} / {occupancySummary.totalCells} cells occupied
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 -mx-4 -my-3 mb-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Levels</h3>
        </div>
        <div className="space-y-1.5">
          {levels.map((level) => (
            <div key={level.levelOrdinal} className="flex justify-between items-center text-xs text-gray-700">
              <span className="font-medium">L{level.levelOrdinal}:</span>
              <span className="text-gray-500">
                {level.occupiedCells}/{level.totalCells}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
