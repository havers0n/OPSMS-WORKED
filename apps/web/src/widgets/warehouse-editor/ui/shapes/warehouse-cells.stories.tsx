import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Cell, OperationsCellRuntime } from '@wos/domain';
import { RackCells } from './rack-cells';
import { WarehouseScene } from '@/storybook/warehouse/warehouse-scene';
import {
  canonicalEmptyCellRuntimeByIdStory,
  canonicalEmptyOccupiedCellIdsStory,
  canonicalLocateTargetCellIdStory,
  canonicalOccupiedCellRuntimeByIdStory,
  canonicalOccupiedCellIdsStory,
  canonicalSearchHitAndLocateCellIdsStory,
  canonicalSearchHitCellIdsStory,
  canonicalSelectedCellIdStory,
  canonicalStorageVariantCellRuntimeByIdStory,
  canonicalStorageVariantOccupiedCellIdsStory,
  canonicalWorkflowSourceCellIdStory,
  degradedOccupiedCellIdsStory,
  degradedOccupiedCellRuntimeByIdStory,
  faceAStory,
  faceBStory,
  layoutOnlyPublishedCellsByStructureStory,
  pairedRackGeometryStory,
  pairedRackStory,
  publishedCellsByStructureStory,
  unknownTruthCellRuntimeByIdStory,
  unknownTruthOccupiedCellIdsStory
} from '@/storybook/warehouse/warehouse-story-fixtures';

type ProofArgs = {
  publishedCellsByStructure: Map<string, Cell>;
  occupiedCellIds: Set<string>;
  cellRuntimeById: Map<string, OperationsCellRuntime>;
  highlightedCellIds: Set<string>;
  selectedCellId: string | null;
  locateTargetCellId: string | null;
  workflowSourceCellId: string | null;
  isWorkflowScope: boolean;
  isSelected: boolean;
};

function renderCellProof(args: ProofArgs) {
  return (
    <WarehouseScene width={Math.ceil(pairedRackGeometryStory.width + 40)} height={Math.ceil(pairedRackGeometryStory.height + 40)}>
      <RackCells
        geometry={pairedRackGeometryStory}
        rackId={pairedRackStory.id}
        faceA={faceAStory}
        faceB={faceBStory}
        isSelected={args.isSelected}
        activeLevelIndex={1}
        publishedCellsByStructure={args.publishedCellsByStructure}
        occupiedCellIds={args.occupiedCellIds}
        cellRuntimeById={args.cellRuntimeById}
        highlightedCellIds={args.highlightedCellIds}
        isInteractive={false}
        isWorkflowScope={args.isWorkflowScope}
        isPassive={false}
        rackRotationDeg={0}
        selectedCellId={args.selectedCellId}
        locateTargetCellId={args.locateTargetCellId}
        workflowSourceCellId={args.workflowSourceCellId}
        showCellNumbers={true}
        cellNumberProminence="dominant"
        showFocusedFullAddress={true}
      />
    </WarehouseScene>
  );
}

const meta = {
  title: 'Warehouse/Proof/Cell Semantics',
  component: RackCells,
  parameters: {
    layout: 'padded'
  },
} satisfies Meta<typeof RackCells>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LayoutOnly: Story = {
  render: () =>
    renderCellProof({
      publishedCellsByStructure: layoutOnlyPublishedCellsByStructureStory,
      occupiedCellIds: canonicalEmptyOccupiedCellIdsStory,
      cellRuntimeById: canonicalEmptyCellRuntimeByIdStory,
      highlightedCellIds: new Set<string>(),
      selectedCellId: null,
      locateTargetCellId: null,
      workflowSourceCellId: null,
      isWorkflowScope: false,
      isSelected: false
    })
};

export const StorageCore: Story = {
  render: () =>
    renderCellProof({
      publishedCellsByStructure: publishedCellsByStructureStory,
      occupiedCellIds: canonicalOccupiedCellIdsStory,
      cellRuntimeById: canonicalOccupiedCellRuntimeByIdStory,
      highlightedCellIds: new Set<string>(),
      selectedCellId: null,
      locateTargetCellId: null,
      workflowSourceCellId: null,
      isWorkflowScope: false,
      isSelected: false
    })
};

export const StorageVariants: Story = {
  render: () =>
    renderCellProof({
      publishedCellsByStructure: publishedCellsByStructureStory,
      occupiedCellIds: canonicalStorageVariantOccupiedCellIdsStory,
      cellRuntimeById: canonicalStorageVariantCellRuntimeByIdStory,
      highlightedCellIds: new Set<string>(),
      selectedCellId: null,
      locateTargetCellId: null,
      workflowSourceCellId: null,
      isWorkflowScope: false,
      isSelected: false
    })
};

export const SelectionOverlay: Story = {
  render: () =>
    renderCellProof({
      publishedCellsByStructure: publishedCellsByStructureStory,
      occupiedCellIds: canonicalOccupiedCellIdsStory,
      cellRuntimeById: canonicalOccupiedCellRuntimeByIdStory,
      highlightedCellIds: new Set<string>(),
      selectedCellId: canonicalSelectedCellIdStory,
      locateTargetCellId: null,
      workflowSourceCellId: null,
      isWorkflowScope: false,
      isSelected: false
    })
};

export const SearchVsLocate: Story = {
  render: () =>
    renderCellProof({
      publishedCellsByStructure: publishedCellsByStructureStory,
      occupiedCellIds: canonicalOccupiedCellIdsStory,
      cellRuntimeById: canonicalOccupiedCellRuntimeByIdStory,
      highlightedCellIds: canonicalSearchHitAndLocateCellIdsStory,
      selectedCellId: null,
      locateTargetCellId: canonicalLocateTargetCellIdStory,
      workflowSourceCellId: null,
      isWorkflowScope: false,
      isSelected: false
    })
};

export const WorkflowMove: Story = {
  render: () =>
    renderCellProof({
      publishedCellsByStructure: publishedCellsByStructureStory,
      occupiedCellIds: degradedOccupiedCellIdsStory,
      cellRuntimeById: degradedOccupiedCellRuntimeByIdStory,
      highlightedCellIds: new Set<string>(),
      selectedCellId: null,
      locateTargetCellId: null,
      workflowSourceCellId: canonicalWorkflowSourceCellIdStory,
      isWorkflowScope: true,
      isSelected: false
    })
};

export const DegradedTruth: Story = {
  render: () =>
    renderCellProof({
      publishedCellsByStructure: publishedCellsByStructureStory,
      occupiedCellIds: degradedOccupiedCellIdsStory,
      cellRuntimeById: degradedOccupiedCellRuntimeByIdStory,
      highlightedCellIds: new Set<string>(),
      selectedCellId: null,
      locateTargetCellId: null,
      workflowSourceCellId: null,
      isWorkflowScope: false,
      isSelected: false
    })
};

export const UnknownTruth: Story = {
  render: () =>
    renderCellProof({
      publishedCellsByStructure: publishedCellsByStructureStory,
      occupiedCellIds: unknownTruthOccupiedCellIdsStory,
      cellRuntimeById: unknownTruthCellRuntimeByIdStory,
      highlightedCellIds: new Set<string>(),
      selectedCellId: null,
      locateTargetCellId: null,
      workflowSourceCellId: null,
      isWorkflowScope: false,
      isSelected: false
    })
};

export const PolicyIsNotState: Story = {
  render: () =>
    renderCellProof({
      publishedCellsByStructure: publishedCellsByStructureStory,
      occupiedCellIds: canonicalOccupiedCellIdsStory,
      cellRuntimeById: canonicalOccupiedCellRuntimeByIdStory,
      highlightedCellIds: canonicalSearchHitCellIdsStory,
      selectedCellId: null,
      locateTargetCellId: null,
      workflowSourceCellId: null,
      isWorkflowScope: false,
      isSelected: false
    }),
  parameters: {
    docs: {
      description: {
        story:
          'Policy metadata is intentionally absent from cell truth inputs here. The proof surface keeps fill storage-driven and reserves policy for surrounding UI.'
      }
    }
  }
};
