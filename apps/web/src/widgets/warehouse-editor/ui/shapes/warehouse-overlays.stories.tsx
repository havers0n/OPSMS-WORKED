import type { Meta, StoryObj } from '@storybook/react-vite';
import { RackCells } from './rack-cells';
import { WarehouseScene } from '@/storybook/warehouse/warehouse-scene';
import {
  cellRuntimeByIdStory,
  faceAStory,
  faceBStory,
  highlightedCellIdsStory,
  occupiedCellIdsStory,
  pairedRackGeometryStory,
  pairedRackStory,
  publishedCellsByStructureStory
} from '@/storybook/warehouse/warehouse-story-fixtures';

const meta = {
  title: 'Warehouse/Overlays/Cell Focus States',
  component: RackCells,
  parameters: {
    layout: 'padded'
  },
  args: {
    geometry: pairedRackGeometryStory,
    rackId: pairedRackStory.id,
    faceA: faceAStory,
    faceB: faceBStory,
    isSelected: true,
    activeLevelIndex: 1,
    publishedCellsByStructure: publishedCellsByStructureStory,
    occupiedCellIds: occupiedCellIdsStory,
    cellRuntimeById: cellRuntimeByIdStory,
    highlightedCellIds: new Set<string>(),
    isInteractive: false,
    isWorkflowScope: false,
    isPassive: false,
    rackRotationDeg: 0,
    selectedCellId: null,
    workflowSourceCellId: null,
    showCellNumbers: true,
    cellNumberProminence: 'dominant',
    showFocusedFullAddress: true
  },
  render: (args) => (
    <WarehouseScene width={Math.ceil(args.geometry.width + 40)} height={Math.ceil(args.geometry.height + 40)}>
      <RackCells {...args} />
    </WarehouseScene>
  )
} satisfies Meta<typeof RackCells>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Selected: Story = {
  args: {
    selectedCellId: 'cell-a-2-2'
  }
};

export const Focused: Story = {
  args: {
    selectedCellId: 'cell-a-2-2',
    showFocusedFullAddress: true
  }
};

export const HighlightedSearchHit: Story = {
  args: {
    highlightedCellIds: highlightedCellIdsStory
  }
};

export const WorkflowLocateSource: Story = {
  args: {
    workflowSourceCellId: 'cell-a-2-3',
    isWorkflowScope: true
  }
};

export const DisabledReadOnly: Story = {
  args: {
    isPassive: true,
    isInteractive: false,
    selectedCellId: 'cell-a-2-2'
  }
};
