import { useRackInspector } from '@/entities/rack/api/use-rack-inspector';
import { RackStatusSummary } from '@/entities/rack/ui/rack-status-summary';
import { InspectorFooter } from './shared';

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
    <div className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <RackStatusSummary
          displayCode={data.displayCode}
          kind={data.kind}
          axis={data.axis}
          occupancySummary={data.occupancySummary}
          levels={data.levels}
        />
      </div>

      <InspectorFooter />
    </div>
  );
}
