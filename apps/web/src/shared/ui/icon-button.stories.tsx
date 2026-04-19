import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton } from '@/shared/ui/icon-button';

const meta = {
  title: 'Shared UI/IconButton',
  component: IconButton,
  args: {
    icon: '+',
    'aria-label': 'Add item',
    variant: 'ghost',
    disabled: false
  },
  argTypes: {
    onClick: { action: 'clicked' }
  }
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ghost: Story = {};

export const Solid: Story = {
  args: {
    variant: 'solid',
    icon: '*',
    'aria-label': 'Confirm action'
  }
};

export const Disabled: Story = {
  args: {
    disabled: true
  }
};
