import type { Meta, StoryObj } from '@storybook/react-vite';
import { WarehouseScenarioComposer } from '@/storybook/warehouse/warehouse-scenario-composer';
import { scenarioStorageSelectedOccupiedContextStory } from '@/storybook/warehouse/warehouse-story-fixtures';
import { StorageLocationSectionsPanel } from '../scenario-panels';

const meta = {
  title: 'Warehouse/Scenarios/Storage',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const SelectedOccupiedLocation: Story = {
  render: () => (
    <WarehouseScenarioComposer
      selectedCellId={scenarioStorageSelectedOccupiedContextStory.selectedCellId}
      panel={
        <StorageLocationSectionsPanel
          containers={scenarioStorageSelectedOccupiedContextStory.containers}
          sourceCellId={scenarioStorageSelectedOccupiedContextStory.selectedCellId}
          inventoryItems={scenarioStorageSelectedOccupiedContextStory.inventoryItems}
          hasContainers={scenarioStorageSelectedOccupiedContextStory.hasContainers}
          policyAssignments={scenarioStorageSelectedOccupiedContextStory.policyAssignments}
          policyPending={scenarioStorageSelectedOccupiedContextStory.policyPending}
        />
      }
    />
  )
};
