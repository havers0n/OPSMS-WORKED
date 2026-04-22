import type { Meta, StoryObj } from '@storybook/react-vite';
import { WarehouseScenarioComposer } from '@/storybook/warehouse/warehouse-scenario-composer';
import {
  canonicalOccupiedCellRuntimeByIdStory,
  canonicalOccupiedCellIdsStory,
  canonicalPolicyOnlyPanelContextStory,
  canonicalSelectedCellIdStory
} from '@/storybook/warehouse/warehouse-story-fixtures';
import { StorageLocationSectionsPanel } from '../scenario-panels';

function PolicyIsNotStateScene() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        Policy metadata is present in the panel, but the selected cell still renders with storage-driven occupied fill. Policy does not create a separate cell fill state.
      </div>
      <WarehouseScenarioComposer
        occupiedCellIds={canonicalOccupiedCellIdsStory}
        cellRuntimeById={canonicalOccupiedCellRuntimeByIdStory}
        selectedCellId={canonicalSelectedCellIdStory}
        panel={
          <StorageLocationSectionsPanel
            containers={canonicalPolicyOnlyPanelContextStory.containers}
            sourceCellId={canonicalSelectedCellIdStory}
            inventoryItems={canonicalPolicyOnlyPanelContextStory.inventoryItems}
            hasContainers={canonicalPolicyOnlyPanelContextStory.hasContainers}
            policyAssignments={canonicalPolicyOnlyPanelContextStory.policyAssignments}
            policyPending={canonicalPolicyOnlyPanelContextStory.policyPending}
          />
        }
      />
    </div>
  );
}

const meta = {
  title: 'Warehouse/Proof/Policy',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const PolicyIsNotStateProof: Story = {
  render: () => <PolicyIsNotStateScene />
};
