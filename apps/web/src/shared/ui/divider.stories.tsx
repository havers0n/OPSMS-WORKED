import type { Meta, StoryObj } from '@storybook/react-vite';
import { Divider } from '@/shared/ui/divider';

const meta = {
  title: 'Shared UI/Divider',
  component: Divider,
  args: {
    orientation: 'horizontal'
  }
} satisfies Meta<typeof Divider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: (args) => (
    <div className="w-64">
      <Divider {...args} />
    </div>
  )
};

export const Vertical: Story = {
  args: {
    orientation: 'vertical'
  },
  render: (args) => (
    <div className="h-16">
      <Divider {...args} />
    </div>
  )
};
