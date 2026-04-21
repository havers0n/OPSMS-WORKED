import type { Meta, StoryObj } from '@storybook/react-vite';
import { RackBody } from './rack-body';
import { WarehouseScene } from '@/storybook/warehouse/warehouse-scene';
import { pairedRackGeometryStory, singleRackGeometryStory } from '@/storybook/warehouse/warehouse-story-fixtures';

const meta = {
  title: 'Warehouse/Rack/Body',
  component: RackBody,
  parameters: {
    layout: 'padded'
  },
  args: {
    geometry: pairedRackGeometryStory,
    displayCode: 'R-14',
    rotationDeg: 0,
    isSelected: false,
    isHovered: false,
    isPassive: false,
    showRackCode: true,
    rackCodeProminence: 'dominant',
    rackCodePlacement: 'header-left'
  },
  render: (args) => (
    <WarehouseScene width={Math.ceil(args.geometry.width + 40)} height={Math.ceil(args.geometry.height + 40)}>
      <RackBody {...args} />
    </WarehouseScene>
  )
} satisfies Meta<typeof RackBody>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = {
  args: {
    isSelected: true
  }
};

export const Hovered: Story = {
  args: {
    isHovered: true
  }
};

export const PassiveReadOnly: Story = {
  args: {
    isPassive: true,
    rackCodeProminence: 'secondary'
  }
};

export const EmptySingleFace: Story = {
  args: {
    geometry: singleRackGeometryStory,
    displayCode: 'R-01'
  }
};

export const VerticalPlacement: Story = {
  args: {
    rotationDeg: 90,
    rackCodePlacement: 'lower-left-mid',
    rackCodeProminence: 'background'
  }
};
