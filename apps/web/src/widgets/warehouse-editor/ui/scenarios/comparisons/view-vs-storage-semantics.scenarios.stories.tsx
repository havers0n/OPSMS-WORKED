import type { Meta, StoryObj } from '@storybook/react-vite';
import { WarehouseScenarioComposer } from '@/storybook/warehouse/warehouse-scenario-composer';
import {
  locationContainerCardsStory,
  locationInventoryItemsStory,
  locationPolicyAssignmentsStory,
  scenarioSearchSingleHitCellIdsStory,
  scenarioStorageSelectedOccupiedContextStory
} from '@/storybook/warehouse/warehouse-story-fixtures';
import {
  CurrentContainersSectionView,
  CurrentInventorySectionView,
  LocationPolicySummarySectionView
} from '@/widgets/warehouse-editor/ui/storage-location-detail-sections-view';

function ViewSemanticsPanel() {
  return (
    <div className="w-full p-3">
      <CurrentContainersSectionView
        containers={[]}
        sourceCellId={null}
        onContainerClick={() => undefined}
      />
      <div className="mt-3">
        <CurrentInventorySectionView inventoryItems={[]} hasContainers={false} />
      </div>
      <div className="mt-3">
        <LocationPolicySummarySectionView
          isPending={false}
          assignments={[]}
        />
      </div>
    </div>
  );
}

function StorageSemanticsPanel() {
  return (
    <div className="w-full p-3">
      <CurrentContainersSectionView
        containers={locationContainerCardsStory.slice(0, 1)}
        sourceCellId={scenarioStorageSelectedOccupiedContextStory.selectedCellId}
        onContainerClick={() => undefined}
      />
      <div className="mt-3">
        <CurrentInventorySectionView
          inventoryItems={locationInventoryItemsStory.slice(0, 1)}
          hasContainers={true}
        />
      </div>
      <div className="mt-3">
        <LocationPolicySummarySectionView
          isPending={false}
          assignments={locationPolicyAssignmentsStory.slice(0, 1)}
        />
      </div>
    </div>
  );
}

function ViewVsStorageSemanticsScene() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <WarehouseScenarioComposer
        highlightedCellIds={scenarioSearchSingleHitCellIdsStory}
        isPassive={true}
        panel={<ViewSemanticsPanel />}
      />
      <WarehouseScenarioComposer
        selectedCellId={scenarioStorageSelectedOccupiedContextStory.selectedCellId}
        panel={<StorageSemanticsPanel />}
      />
    </div>
  );
}

const meta = {
  title: 'Warehouse/Scenarios/Comparisons',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ViewVsStorageSemantics: Story = {
  render: () => <ViewVsStorageSemanticsScene />
};
