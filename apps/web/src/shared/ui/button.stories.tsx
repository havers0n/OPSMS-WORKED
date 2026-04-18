import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/shared/ui/button';

const meta = {
  title: 'Shared UI/Button',
  component: Button,
  args: {
    children: 'Action',
    variant: 'ghost',
    size: 'sm',
    disabled: false
  },
  argTypes: {
    onClick: { action: 'clicked' }
  }
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ghost: Story = {};

export const Solid: Story = {
  args: {
    variant: 'solid',
    children: 'Save changes'
  }
};

export const Icon: Story = {
  args: {
    size: 'icon',
    children: '+',
    'aria-label': 'Add'
  }
};

export const Disabled: Story = {
  args: {
    disabled: true
  }
};
