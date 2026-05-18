import { useRackInspector } from '@/entities/rack/api/use-rack-inspector';
import {
  useStorageFocusActiveLevel,
  useStorageFocusSetActiveLevel
} from '@/warehouse/editor/model/v2/v2-selectors';
import { RackOverviewPanelView } from './rack-overview-panel-view';

export function RackOverviewPanel({ rackId }: { rackId: string }) {
  const { data, isLoading, isError } = useRackInspector(rackId);
  const activeLevel = useStorageFocusActiveLevel();
  const setActiveLevel = useStorageFocusSetActiveLevel();

  if (isLoading) {
    return <RackOverviewPanelView status="loading" />;
  }

  if (isError || !data) {
    return <RackOverviewPanelView status="error" />;
  }

  return (
    <RackOverviewPanelView
      status="ready"
      activeLevel={activeLevel}
      onLevelSelect={setActiveLevel}
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
