import {
  CurrentContainersSectionView,
  CurrentInventorySectionView,
  LocationPolicySummarySectionView,
  type CurrentContainerCardViewModel,
  type CurrentInventorySummaryItemViewModel,
  type LocationPolicySummaryAssignmentViewModel
} from '@/widgets/warehouse-editor/ui/storage-location-detail-sections-view';
import {
  RackOverviewPanelView,
  type RackOverviewPanelViewProps
} from '@/widgets/warehouse-editor/ui/storage-inspector-v2/rack-overview-panel-view';

export function StorageLocationSectionsPanel({
  containers,
  sourceCellId,
  inventoryItems,
  hasContainers,
  policyAssignments,
  policyPending
}: {
  containers: CurrentContainerCardViewModel[];
  sourceCellId: string | null;
  inventoryItems: CurrentInventorySummaryItemViewModel[];
  hasContainers: boolean;
  policyAssignments: LocationPolicySummaryAssignmentViewModel[];
  policyPending: boolean;
}) {
  return (
    <div className="w-full p-3">
      <CurrentContainersSectionView
        containers={containers}
        sourceCellId={sourceCellId}
        onContainerClick={() => undefined}
      />
      <div className="mt-3">
        <CurrentInventorySectionView
          inventoryItems={inventoryItems}
          hasContainers={hasContainers}
        />
      </div>
      <div className="mt-3">
        <LocationPolicySummarySectionView
          isPending={policyPending}
          assignments={policyAssignments}
        />
      </div>
    </div>
  );
}

export function RackOverviewScenarioPanel(props: RackOverviewPanelViewProps) {
  return <RackOverviewPanelView {...props} />;
}
