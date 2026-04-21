import type { Meta, StoryObj } from '@storybook/react-vite';
import { RackSections } from './rack-sections';
import { WarehouseScene } from '@/storybook/warehouse/warehouse-scene';
import { faceAStory, faceBStory, pairedRackGeometryStory, singleRackGeometryStory } from '@/storybook/warehouse/warehouse-story-fixtures';

const meta = {
  title: 'Warehouse/Section/Rack Sections',
  component: RackSections,
  parameters: {
    layout: 'padded'
  },
  args: {
    geometry: pairedRackGeometryStory,
    faceA: faceAStory,
    faceB: faceBStory,
    isSelected: false,
    isPassive: false,
    rackRotationDeg: 0,
    showFaceToken: true,
    showSectionNumbers: true,
    faceTokenProminence: 'dominant',
    sectionNumberProminence: 'dominant'
  },
  render: (args) => (
    <WarehouseScene width={Math.ceil(args.geometry.width + 40)} height={Math.ceil(args.geometry.height + 40)}>
      <RackSections {...args} />
    </WarehouseScene>
  )
} satisfies Meta<typeof RackSections>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = {
  args: {
    isSelected: true
  }
};

export const Passive: Story = {
  args: {
    isPassive: true,
    faceTokenProminence: 'secondary',
    sectionNumberProminence: 'secondary'
  }
};

export const TokensOnly: Story = {
  args: {
    showSectionNumbers: false
  }
};

export const EmptySingleFace: Story = {
  args: {
    geometry: singleRackGeometryStory,
    faceB: null,
    showFaceToken: false
  }
};
