import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '@/shared/ui/badge';

const meta = {
  title: 'Shared UI/Badge',
  component: Badge,
  args: {
    children: 'Ready',
    tone: 'neutral'
  }
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = {};

export const Info: Story = {
  args: {
    tone: 'info',
    children: 'Syncing'
  }
};

export const Success: Story = {
  args: {
    tone: 'success',
    children: 'Completed'
  }
};

export const Warning: Story = {
  args: {
    tone: 'warning',
    children: 'Attention'
  }
};

export const Danger: Story = {
  args: {
    tone: 'danger',
    children: 'Blocked'
  }
};

export const WithIcon: Story = {
  args: {
    tone: 'info',
    icon: 'i',
    children: 'Live'
  }
};
