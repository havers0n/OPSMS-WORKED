import type { Meta, StoryObj } from '@storybook/react-vite';
import { FaceModeIsometric } from './rack-inspector/face-mode-isometric';
import { pairedRackStory, singleRackStory, faceBStory } from '@/storybook/warehouse/warehouse-story-fixtures';

const meta = {
  title: 'Warehouse/Reference/Rack/Mode Visuals',
  component: FaceModeIsometric,
  args: {
    rack: pairedRackStory,
    faceB: faceBStory,
    readOnly: false,
    onSelectTopology: () => undefined
  }
} satisfies Meta<typeof FaceModeIsometric>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SingleFaceMode: Story = {
  args: {
    rack: singleRackStory,
    faceB: null
  }
};

export const ReadOnly: Story = {
  args: {
    readOnly: true
  }
};
