import { useRackInspector } from '@/entities/rack/api/use-rack-inspector';
import { RackOverviewPanelView } from './rack-overview-panel-view';

export function RackOverviewPanel({ rackId }: { rackId: string }) {
  const { data, isLoading, isError } = useRackInspector(rackId);

  if (isLoading) {
    return <RackOverviewPanelView status="loading" />;
  }

  if (isError || !data) {
    return <RackOverviewPanelView status="error" />;
  }

  return (
    <RackOverviewPanelView
      status="ready"
      summary={{
        displayCode: data.displayCode,
        kind: data.kind,
        axis: data.axis,
        occupancySummary: data.occupancySummary,
        levels: data.levels
      }}
    />
  );
}
