import { OccupancyBar } from '@/entities/location/ui/occupancy-bar';

export interface RackStatusSummaryProps {
  displayCode: string;
  kind: string;
  axis: string;
  activeLevel?: number | null;
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
  onLevelSelect?: (level: number) => void;
}

export function RackStatusSummary({
  displayCode,
  kind,
  axis,
  activeLevel = null,
  occupancySummary,
  levels,
  onLevelSelect
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
          {levels.map((level) => {
            const isActive = activeLevel === level.levelOrdinal;
            const interactiveClassName = `flex w-full items-center justify-between rounded-sm px-2.5 py-1.5 text-xs transition-colors ${
              isActive
                ? 'bg-blue-50 text-blue-900 ring-1 ring-blue-200'
                : 'bg-gray-50 text-gray-700'
            }`;

            const content = (
              <>
                <span className="font-medium">L{level.levelOrdinal}:</span>
                <span className={`font-mono text-[11px] ${isActive ? 'text-blue-700' : 'text-gray-500'}`}>
                  {level.occupiedCells}/{level.totalCells}
                </span>
              </>
            );

            return onLevelSelect ? (
              <button
                key={level.levelOrdinal}
                type="button"
                className={`${interactiveClassName} hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300`}
                aria-label={`Open level ${level.levelOrdinal}`}
                aria-pressed={isActive}
                onClick={() => onLevelSelect(level.levelOrdinal)}
              >
                {content}
              </button>
            ) : (
              <div
                key={level.levelOrdinal}
                className="flex items-center justify-between rounded-sm bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700"
              >
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
