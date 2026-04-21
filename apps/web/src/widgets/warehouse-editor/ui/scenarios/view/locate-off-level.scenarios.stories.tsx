import type { Meta, StoryObj } from '@storybook/react-vite';
import { WarehouseScenarioComposer } from '@/storybook/warehouse/warehouse-scenario-composer';
import {
  rackOverviewFocusedSummaryStory,
  scenarioOffLevelLocateContextStory
} from '@/storybook/warehouse/warehouse-story-fixtures';
import { RackOverviewScenarioPanel } from '../scenario-panels';

const meta = {
  title: 'Warehouse/Scenarios/View',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const LocateOffLevel: Story = {
  render: () => (
    <WarehouseScenarioComposer
      activeLevelIndex={scenarioOffLevelLocateContextStory.activeLevelIndex}
      highlightedCellIds={new Set<string>()}
      panel={
        <RackOverviewScenarioPanel
          status="ready"
          summary={rackOverviewFocusedSummaryStory}
        />
      }
    />
  )
};
