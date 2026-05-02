import type { Meta, StoryObj } from '@storybook/react-vite';
import { AddressAnatomy } from './rack-inspector/address-anatomy';
import { faceAStory, faceBStory } from '@/storybook/warehouse/warehouse-story-fixtures';

const meta = {
  title: 'Warehouse/Reference/Badges/Address Anatomy',
  component: AddressAnatomy,
  args: {
    faceA: faceAStory,
    faceB: faceBStory
  }
} satisfies Meta<typeof AddressAnatomy>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SingleFace: Story = {
  args: {
    faceB: null
  }
};

export const RtlFace: Story = {
  args: {
    faceA: {
      ...faceAStory,
      slotNumberingDirection: 'rtl'
    },
    faceB: null
  }
};
