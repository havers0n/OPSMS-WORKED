import type { Meta, StoryObj } from '@storybook/react-vite';
import { RackOverviewPanelView } from './rack-overview-panel-view';
import {
  rackOverviewFocusedSummaryStory,
  rackOverviewSummaryStory,
  rackOverviewWarningSummaryStory
} from '@/storybook/warehouse/warehouse-story-fixtures';

const meta = {
  title: 'Warehouse/Reference/Inspector/Rack Overview Panel',
  parameters: {
    layout: 'centered'
  },
  decorators: [
    (Story) => (
      <div className="h-[32rem] w-[19rem] border border-gray-200 bg-white">
        <Story />
      </div>
    )
  ]
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const EmptyContext: Story = {
  render: () => <RackOverviewPanelView status="empty" />
};

export const Populated: Story = {
  render: () => <RackOverviewPanelView status="ready" summary={rackOverviewSummaryStory} />
};

export const FocusedLevelState: Story = {
  render: () => <RackOverviewPanelView status="ready" summary={rackOverviewFocusedSummaryStory} />
};

export const NearCapacitySummary: Story = {
  render: () => <RackOverviewPanelView status="ready" summary={rackOverviewWarningSummaryStory} />
};
