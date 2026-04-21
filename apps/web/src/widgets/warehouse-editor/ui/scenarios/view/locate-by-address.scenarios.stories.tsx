import type { Meta, StoryObj } from '@storybook/react-vite';
import { WarehouseScenarioComposer } from '@/storybook/warehouse/warehouse-scenario-composer';
import { scenarioAddressLocateCellIdStory } from '@/storybook/warehouse/warehouse-story-fixtures';

const meta = {
  title: 'Warehouse/Scenarios/View',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const LocateByAddress: Story = {
  render: () => (
    <WarehouseScenarioComposer highlightedCellIds={new Set([scenarioAddressLocateCellIdStory])} />
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Uses the same target visual semantics as LocateSingleHit when address resolve lands on a single location.'
      }
    }
  }
};
