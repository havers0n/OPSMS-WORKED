import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton } from '@/shared/ui/icon-button';
import { ToolRail } from '@/shared/ui/tool-rail';

const meta = {
  title: 'Shared UI/ToolRail',
  component: ToolRail,
  args: {
    orientation: 'vertical'
  }
} satisfies Meta<typeof ToolRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Vertical: Story = {
  render: (args) => (
    <ToolRail {...args}>
      <IconButton icon="+" aria-label="Create" />
      <IconButton icon="-" aria-label="Remove" />
      <IconButton icon="=" aria-label="Align" />
    </ToolRail>
  )
};

export const Horizontal: Story = {
  args: {
    orientation: 'horizontal'
  },
  render: (args) => (
    <ToolRail {...args}>
      <IconButton icon="A" aria-label="Action A" />
      <IconButton icon="B" aria-label="Action B" />
      <IconButton icon="C" aria-label="Action C" />
    </ToolRail>
  )
};
