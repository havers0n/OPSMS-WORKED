import type { Meta, StoryObj } from '@storybook/react-vite';
import { WarehouseScenarioComposer } from '@/storybook/warehouse/warehouse-scenario-composer';
import {
  degradedOccupiedCellIdsStory,
  degradedOccupiedCellRuntimeByIdStory,
  unknownTruthCellRuntimeByIdStory,
  unknownTruthOccupiedCellIdsStory
} from '@/storybook/warehouse/warehouse-story-fixtures';

function ProofLabel({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</div>
      <div className="text-sm text-slate-700">{description}</div>
    </div>
  );
}

function DegradedTruthScene() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-3">
        <ProofLabel
          title="Fallback Occupied"
          description="Fallback occupied stays on the canonical occupied fill and adds an internal degraded marker."
        />
        <WarehouseScenarioComposer
          occupiedCellIds={degradedOccupiedCellIdsStory}
          cellRuntimeById={degradedOccupiedCellRuntimeByIdStory}
        />
      </div>
      <div className="space-y-3">
        <ProofLabel
          title="Unknown Truth"
          description="Unknown truth does not render as empty. It stays on the frame and uses an internal marker."
        />
        <WarehouseScenarioComposer
          occupiedCellIds={unknownTruthOccupiedCellIdsStory}
          cellRuntimeById={unknownTruthCellRuntimeByIdStory}
        />
      </div>
    </div>
  );
}

const meta = {
  title: 'Warehouse/Proof/Truth',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const DegradedTruthProof: Story = {
  render: () => <DegradedTruthScene />
};
