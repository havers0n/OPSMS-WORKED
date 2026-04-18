import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState } from '@/shared/ui/empty-state';
import { Button } from '@/shared/ui/button';

const meta = {
  title: 'Shared UI/EmptyState',
  component: EmptyState,
  args: {
    title: 'No data yet',
    description: 'Connect a source or create an item to see content here.'
  }
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {};

export const WithIcon: Story = {
  args: {
    icon: '[BOX]',
    title: 'No containers in this location',
    description: 'Add a container to start placing inventory.'
  }
};

export const WithAction: Story = {
  args: {
    icon: '[BOX]',
    title: 'Storage location is empty',
    description: 'Add inventory to make this location operational.',
    action: <Button variant="solid">Add inventory</Button>
  }
};
