import type { Meta, StoryObj } from '@storybook/react-vite';
import { WarehouseScenarioComposer } from '@/storybook/warehouse/warehouse-scenario-composer';
import {
  scenarioLocateTargetCellIdStory,
  scenarioSearchSingleHitCellIdsStory
} from '@/storybook/warehouse/warehouse-story-fixtures';

function SearchHitVsLocateTargetScene() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <WarehouseScenarioComposer highlightedCellIds={scenarioSearchSingleHitCellIdsStory} />
      <WarehouseScenarioComposer workflowSourceCellId={scenarioLocateTargetCellIdStory} />
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

export const SearchHitVsLocateTarget: Story = {
  render: () => <SearchHitVsLocateTargetScene />
};
