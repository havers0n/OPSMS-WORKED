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
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-gray-900">{displayCode}</span>
          <span className="rounded-sm bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
            Rack
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-500">
          <span className="capitalize">{kind}</span>
          <span className="text-gray-300">/</span>
          <span>{axis}</span>
        </div>
      </div>

      <div className="border-b border-gray-200 px-4 py-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Occupancy</h3>
        <OccupancyBar rate={occupancySummary.occupancyRate} />
        <div className="mt-1.5 text-xs text-gray-500">
          {occupancySummary.occupiedCells} / {occupancySummary.totalCells} cells occupied
        </div>
      </div>

      <div className="px-4 py-3">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Levels</h3>
        <div className="space-y-1">
          {levels.map((level) => (
            <div
              key={level.levelOrdinal}
              className="flex items-center justify-between rounded-sm bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700"
            >
              <span className="font-medium">L{level.levelOrdinal}:</span>
              <span className="font-mono text-[11px] text-gray-500">
                {level.occupiedCells}/{level.totalCells}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
