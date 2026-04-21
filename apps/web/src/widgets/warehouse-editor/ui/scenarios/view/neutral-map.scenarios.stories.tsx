import type { Meta, StoryObj } from '@storybook/react-vite';
import { WarehouseScenarioComposer } from '@/storybook/warehouse/warehouse-scenario-composer';

const meta = {
  title: 'Warehouse/Scenarios/View',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const NeutralMap: Story = {
  render: () => <WarehouseScenarioComposer occupiedCellIds={new Set<string>()} />
};
