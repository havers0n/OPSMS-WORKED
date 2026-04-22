import type { Meta, StoryObj } from '@storybook/react-vite';
import { WarehouseScenarioComposer } from '@/storybook/warehouse/warehouse-scenario-composer';
import {
  canonicalOccupiedCellRuntimeByIdStory,
  canonicalOccupiedCellIdsStory,
  canonicalPolicyOnlyPanelContextStory,
  canonicalSelectedCellIdStory
} from '@/storybook/warehouse/warehouse-story-fixtures';
import { StorageLocationSectionsPanel } from '../scenario-panels';

function ShellLabel({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</div>
      <div className="text-sm text-slate-700">{description}</div>
    </div>
  );
}

function EmptyReadOnlyPanel() {
  return (
    <div className="space-y-3 p-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        Read-only shell context. Base and fill stay identical to storage for the same truth.
      </div>
    </div>
  );
}

function StoragePanel() {
  return (
    <StorageLocationSectionsPanel
      containers={canonicalPolicyOnlyPanelContextStory.containers}
      sourceCellId={canonicalSelectedCellIdStory}
      inventoryItems={canonicalPolicyOnlyPanelContextStory.inventoryItems}
      hasContainers={canonicalPolicyOnlyPanelContextStory.hasContainers}
      policyAssignments={canonicalPolicyOnlyPanelContextStory.policyAssignments}
      policyPending={canonicalPolicyOnlyPanelContextStory.policyPending}
    />
  );
}

function ViewVsStorageParityScene() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-3">
        <ShellLabel
          title="View"
          description="Read-only shell. Same base and occupied fill as storage."
        />
        <WarehouseScenarioComposer
          occupiedCellIds={canonicalOccupiedCellIdsStory}
          cellRuntimeById={canonicalOccupiedCellRuntimeByIdStory}
          panel={<EmptyReadOnlyPanel />}
        />
      </div>
      <div className="space-y-3">
        <ShellLabel
          title="Storage"
          description="Operational shell. Same base and occupied fill, with panel behavior only changing around the canvas."
        />
        <WarehouseScenarioComposer
          occupiedCellIds={canonicalOccupiedCellIdsStory}
          cellRuntimeById={canonicalOccupiedCellRuntimeByIdStory}
          selectedCellId={canonicalSelectedCellIdStory}
          panel={<StoragePanel />}
        />
      </div>
    </div>
  );
}

const meta = {
  title: 'Warehouse/Proof/Parity',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ViewVsStorageParityProof: Story = {
  render: () => <ViewVsStorageParityScene />
};
