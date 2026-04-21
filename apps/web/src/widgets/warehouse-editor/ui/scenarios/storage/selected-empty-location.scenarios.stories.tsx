import type { Meta, StoryObj } from '@storybook/react-vite';
import { WarehouseScenarioComposer } from '@/storybook/warehouse/warehouse-scenario-composer';
import { scenarioStorageSelectedEmptyContextStory } from '@/storybook/warehouse/warehouse-story-fixtures';
import { StorageLocationSectionsPanel } from '../scenario-panels';

const meta = {
  title: 'Warehouse/Scenarios/Storage',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const SelectedEmptyLocation: Story = {
  render: () => (
    <WarehouseScenarioComposer
      selectedCellId={scenarioStorageSelectedEmptyContextStory.selectedCellId}
      panel={
        <StorageLocationSectionsPanel
          containers={scenarioStorageSelectedEmptyContextStory.containers}
          sourceCellId={scenarioStorageSelectedEmptyContextStory.selectedCellId}
          inventoryItems={scenarioStorageSelectedEmptyContextStory.inventoryItems}
          hasContainers={scenarioStorageSelectedEmptyContextStory.hasContainers}
          policyAssignments={scenarioStorageSelectedEmptyContextStory.policyAssignments}
          policyPending={scenarioStorageSelectedEmptyContextStory.policyPending}
        />
      }
    />
  )
};
