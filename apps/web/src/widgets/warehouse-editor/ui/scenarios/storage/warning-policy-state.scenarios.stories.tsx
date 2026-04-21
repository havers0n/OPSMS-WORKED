import type { Meta, StoryObj } from '@storybook/react-vite';
import { WarehouseScenarioComposer } from '@/storybook/warehouse/warehouse-scenario-composer';
import { scenarioStorageWarningPolicyContextStory } from '@/storybook/warehouse/warehouse-story-fixtures';
import { StorageLocationSectionsPanel } from '../scenario-panels';

const meta = {
  title: 'Warehouse/Scenarios/Storage',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WarningPolicyState: Story = {
  render: () => (
    <WarehouseScenarioComposer
      selectedCellId={scenarioStorageWarningPolicyContextStory.selectedCellId}
      panel={
        <StorageLocationSectionsPanel
          containers={scenarioStorageWarningPolicyContextStory.containers}
          sourceCellId={scenarioStorageWarningPolicyContextStory.selectedCellId}
          inventoryItems={scenarioStorageWarningPolicyContextStory.inventoryItems}
          hasContainers={scenarioStorageWarningPolicyContextStory.hasContainers}
          policyAssignments={scenarioStorageWarningPolicyContextStory.policyAssignments}
          policyPending={scenarioStorageWarningPolicyContextStory.policyPending}
        />
      }
    />
  )
};
