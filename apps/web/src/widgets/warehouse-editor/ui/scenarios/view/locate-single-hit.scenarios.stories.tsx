import type { Meta, StoryObj } from '@storybook/react-vite';
import { WarehouseScenarioComposer } from '@/storybook/warehouse/warehouse-scenario-composer';
import { scenarioSearchSingleHitCellIdsStory } from '@/storybook/warehouse/warehouse-story-fixtures';

const meta = {
  title: 'Warehouse/Scenarios/View',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const LocateSingleHit: Story = {
  render: () => <WarehouseScenarioComposer highlightedCellIds={scenarioSearchSingleHitCellIdsStory} />
};
