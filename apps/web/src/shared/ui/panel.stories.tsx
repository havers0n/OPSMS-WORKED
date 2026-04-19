import type { Meta, StoryObj } from '@storybook/react-vite';
import { Panel } from '@/shared/ui/panel';

const meta = {
  title: 'Shared UI/Panel',
  component: Panel,
  args: {
    tone: 'default',
    padding: 'md'
  }
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Panel {...args}>
      <p className="text-sm">Neutral panel content</p>
    </Panel>
  )
};

export const Muted: Story = {
  args: {
    tone: 'muted'
  },
  render: (args) => (
    <Panel {...args}>
      <p className="text-sm">Muted tone for passive surfaces</p>
    </Panel>
  )
};
