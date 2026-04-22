import type { Meta, StoryObj } from '@storybook/react-vite';
import { WarehouseScenarioComposer } from '@/storybook/warehouse/warehouse-scenario-composer';
import {
  canonicalEmptyCellRuntimeByIdStory,
  canonicalEmptyOccupiedCellIdsStory,
  canonicalOccupiedCellRuntimeByIdStory,
  canonicalOccupiedCellIdsStory
} from '@/storybook/warehouse/warehouse-story-fixtures';

function ProofLabel({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</div>
      <div className="text-sm text-slate-700">{description}</div>
    </div>
  );
}

function StorageCoreScene() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-3">
        <ProofLabel
          title="Empty"
          description="Published cells with runtime-confirmed empty truth."
        />
        <WarehouseScenarioComposer
          occupiedCellIds={canonicalEmptyOccupiedCellIdsStory}
          cellRuntimeById={canonicalEmptyCellRuntimeByIdStory}
        />
      </div>
      <div className="space-y-3">
        <ProofLabel
          title="Occupied"
          description="Same geometry with storage truth changed to occupied."
        />
        <WarehouseScenarioComposer
          occupiedCellIds={canonicalOccupiedCellIdsStory}
          cellRuntimeById={canonicalOccupiedCellRuntimeByIdStory}
        />
      </div>
    </div>
  );
}

const meta = {
  title: 'Warehouse/Proof/Storage',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const StorageCoreProof: Story = {
  render: () => <StorageCoreScene />
};
