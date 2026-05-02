import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  CurrentContainersSectionView,
  CurrentInventorySectionView,
  LocationPolicySummarySectionView
} from './storage-location-detail-sections-view';
import {
  locationContainerCardsStory,
  locationInventoryItemsStory,
  locationPolicyAssignmentsStory
} from '@/storybook/warehouse/warehouse-story-fixtures';

function SectionsShowcase({
  containers,
  inventoryItems,
  hasContainers,
  policyAssignments,
  policyPending
}: {
  containers: Parameters<typeof CurrentContainersSectionView>[0]['containers'];
  inventoryItems: Parameters<typeof CurrentInventorySectionView>[0]['inventoryItems'];
  hasContainers: boolean;
  policyAssignments: Parameters<typeof LocationPolicySummarySectionView>[0]['assignments'];
  policyPending: boolean;
}) {
  return (
    <div className="w-[21rem] space-y-3 bg-white p-3">
      <CurrentContainersSectionView
        containers={containers}
        sourceCellId="cell-a-2-2"
        onContainerClick={() => undefined}
      />
      <CurrentInventorySectionView inventoryItems={inventoryItems} hasContainers={hasContainers} />
      <LocationPolicySummarySectionView
        isPending={policyPending}
        assignments={policyAssignments}
        onEdit={() => undefined}
      />
    </div>
  );
}

const meta = {
  title: 'Warehouse/Reference/Inspector/Location Detail Sections',
  component: SectionsShowcase,
  parameters: {
    layout: 'centered'
  }
} satisfies Meta<typeof SectionsShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyLocation: Story = {
  args: {
    containers: [],
    inventoryItems: [],
    hasContainers: false,
    policyAssignments: [],
    policyPending: false
  }
};

export const OccupiedLocation: Story = {
  args: {
    containers: locationContainerCardsStory.slice(0, 1),
    inventoryItems: locationInventoryItemsStory.slice(0, 1),
    hasContainers: true,
    policyAssignments: locationPolicyAssignmentsStory.slice(0, 1),
    policyPending: false
  }
};

export const MultipleContainersInventory: Story = {
  args: {
    containers: locationContainerCardsStory,
    inventoryItems: locationInventoryItemsStory,
    hasContainers: true,
    policyAssignments: locationPolicyAssignmentsStory,
    policyPending: false
  }
};

export const PendingPolicySection: Story = {
  args: {
    containers: [
      {
        ...locationContainerCardsStory[1],
        status: 'damaged'
      }
    ],
    inventoryItems: [],
    hasContainers: true,
    policyAssignments: [],
    policyPending: true
  }
};
