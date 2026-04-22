import type { Meta, StoryObj } from '@storybook/react-vite';
import { WarehouseScenarioComposer } from '@/storybook/warehouse/warehouse-scenario-composer';

function LayoutOnlyScene() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        Layout-only proof. The rack renders structure only, with no storage fill and no interaction overlays.
      </div>
      <WarehouseScenarioComposer showCells={false} />
    </div>
  );
}

const meta = {
  title: 'Warehouse/Scenarios/View',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const LayoutOnlyProof: Story = {
  render: () => <LayoutOnlyScene />
};
