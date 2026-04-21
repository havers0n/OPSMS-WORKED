import { useRackInspector } from '@/entities/rack/api/use-rack-inspector';
import { RackStatusSummary } from '@/entities/rack/ui/rack-status-summary';
import {
  inspectorBodyPaddingClassName,
  inspectorScrollBodyClassName,
  inspectorShellClassName,
  InspectorFooter
} from './shared';

export function RackOverviewPanel({ rackId }: { rackId: string }) {
  const { data, isLoading, isError } = useRackInspector(rackId);

  if (isLoading) {
    return (
      <div className={inspectorShellClassName}>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="text-sm text-gray-400">Loading rack...</p>
        </div>
        <InspectorFooter />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={inspectorShellClassName}>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="text-sm text-red-500">Failed to load rack data</p>
        </div>
        <InspectorFooter />
      </div>
    );
  }

  return (
    <div className={inspectorShellClassName}>
      <div className={inspectorScrollBodyClassName}>
        <div className={inspectorBodyPaddingClassName}>
          <RackStatusSummary
            displayCode={data.displayCode}
            kind={data.kind}
            axis={data.axis}
            occupancySummary={data.occupancySummary}
            levels={data.levels}
          />
        </div>
      </div>

      <InspectorFooter />
    </div>
  );
}
