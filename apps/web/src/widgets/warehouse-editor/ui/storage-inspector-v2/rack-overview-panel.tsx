import { useRackInspector } from '@/entities/rack/api/use-rack-inspector';
import { InspectorFooter, OccupancyBar, SectionHeader } from './shared';

export function RackOverviewPanel({ rackId }: { rackId: string }) {
  const { data, isLoading, isError } = useRackInspector(rackId);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden">
        <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
          <p className="text-sm text-gray-400">Loading rack…</p>
        </div>
        <InspectorFooter />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden">
        <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
          <p className="text-sm text-red-500">Failed to load rack data</p>
        </div>
        <InspectorFooter />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden" role="complementary" aria-label={`Rack overview: ${data.displayCode}`}>
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="font-mono font-semibold text-gray-900">{data.displayCode}</span>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="capitalize">{data.kind}</span>
            <span className="text-gray-300">·</span>
            <span>{data.axis}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <SectionHeader title="Occupancy" />
        <div className="px-4 py-3 border-b border-gray-200 space-y-2">
          <OccupancyBar rate={data.occupancySummary.occupancyRate} />
          <div className="text-xs text-gray-500">
            {data.occupancySummary.occupiedCells} / {data.occupancySummary.totalCells} cells occupied
          </div>
        </div>

        <SectionHeader title="Levels" />
        <div className="px-4 py-3 space-y-1.5">
          {data.levels.map((level) => (
            <div key={level.levelOrdinal} className="flex justify-between items-center text-xs text-gray-700">
              <span className="font-medium">L{level.levelOrdinal}:</span>
              <span className="text-gray-500">{level.occupiedCells}/{level.totalCells}</span>
            </div>
          ))}
        </div>
      </div>

      <InspectorFooter />
    </div>
  );
}
