import type { Meta, StoryObj } from '@storybook/react-vite';
import { WarehouseScenarioComposer } from '@/storybook/warehouse/warehouse-scenario-composer';
import { scenarioSelectedCellIdStory } from '@/storybook/warehouse/warehouse-story-fixtures';

function SelectedVsFocusedScene() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <WarehouseScenarioComposer
        selectedCellId={scenarioSelectedCellIdStory}
        showFocusedFullAddress={false}
      />
      <WarehouseScenarioComposer
        selectedCellId={scenarioSelectedCellIdStory}
        showFocusedFullAddress={true}
      />
    </div>
  );
}

const meta = {
  title: 'Warehouse/Scenarios/Comparisons',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const SelectedVsFocused: Story = {
  render: () => <SelectedVsFocusedScene />,
  parameters: {
    docs: {
      description: {
        story:
          'Semantic comparison only. If visual distinction appears weak, treat it as an explicit semantic gap rather than a story-level redesign.'
      }
    }
  }
};
