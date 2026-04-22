import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Cell, OperationsCellRuntime } from '@wos/domain';
import { RackCells } from './rack-cells';
import { WarehouseScenarioComposer } from '@/storybook/warehouse/warehouse-scenario-composer';
import { WarehouseScene } from '@/storybook/warehouse/warehouse-scene';
import {
  canonicalEmptyCellRuntimeByIdStory,
  canonicalEmptyOccupiedCellIdsStory,
  canonicalLocateTargetCellIdStory,
  canonicalOccupiedCellRuntimeByIdStory,
  canonicalOccupiedCellIdsStory,
  canonicalPolicyOnlyPanelContextStory,
  canonicalReservedCellIdStory,
  canonicalReservedCellRuntimeByIdStory,
  canonicalReservedOccupiedCellIdsStory,
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
import { StorageLocationSectionsPanel } from '../scenarios/scenario-panels';

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

function ProofShellLabel({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</div>
      <div className="text-sm text-slate-700">{description}</div>
    </div>
  );
}

function EmptyReadOnlyPanel() {
  return (
    <div className="space-y-3 p-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        Read-only shell context. Base and fill stay identical to storage for the same truth.
      </div>
    </div>
  );
}

function StoragePanel() {
  return (
    <StorageLocationSectionsPanel
      containers={canonicalPolicyOnlyPanelContextStory.containers}
      sourceCellId={canonicalSelectedCellIdStory}
      inventoryItems={canonicalPolicyOnlyPanelContextStory.inventoryItems}
      hasContainers={canonicalPolicyOnlyPanelContextStory.hasContainers}
      policyAssignments={canonicalPolicyOnlyPanelContextStory.policyAssignments}
      policyPending={canonicalPolicyOnlyPanelContextStory.policyPending}
    />
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

export const Reserved: Story = {
  render: () =>
    renderCellProof({
      publishedCellsByStructure: publishedCellsByStructureStory,
      occupiedCellIds: canonicalReservedOccupiedCellIdsStory,
      cellRuntimeById: canonicalReservedCellRuntimeByIdStory,
      highlightedCellIds: new Set<string>(),
      selectedCellId: null,
      locateTargetCellId: null,
      workflowSourceCellId: null,
      isWorkflowScope: false,
      isSelected: false
    })
};

function ReservedProofCase({
  title,
  description,
  highlightedCellIds,
  selectedCellId,
  locateTargetCellId
}: {
  title: string;
  description: string;
  highlightedCellIds: Set<string>;
  selectedCellId: string | null;
  locateTargetCellId: string | null;
}) {
  return (
    <div className="space-y-3">
      <ProofShellLabel title={title} description={description} />
      {renderCellProof({
        publishedCellsByStructure: publishedCellsByStructureStory,
        occupiedCellIds: canonicalReservedOccupiedCellIdsStory,
        cellRuntimeById: canonicalReservedCellRuntimeByIdStory,
        highlightedCellIds,
        selectedCellId,
        locateTargetCellId,
        workflowSourceCellId: null,
        isWorkflowScope: false,
        isSelected: false
      })}
    </div>
  );
}

export const ReservedProof: Story = {
  render: () => (
    <div className="grid gap-4 xl:grid-cols-2">
      <ReservedProofCase
        title="Reserved"
        description="Lilac dotted storage surface with no interaction overlay."
        highlightedCellIds={new Set<string>()}
        selectedCellId={null}
        locateTargetCellId={null}
      />
      <ReservedProofCase
        title="Reserved + Selected"
        description="Selection stays outline-only above the reserved surface."
        highlightedCellIds={new Set<string>()}
        selectedCellId={canonicalReservedCellIdStory}
        locateTargetCellId={null}
      />
      <ReservedProofCase
        title="Reserved + Search-Hit"
        description="Search stays halo-only and does not replace the reserved fill."
        highlightedCellIds={new Set<string>([canonicalReservedCellIdStory])}
        selectedCellId={null}
        locateTargetCellId={null}
      />
      <ReservedProofCase
        title="Reserved + Locate-Target"
        description="Locate stays halo-only above the reserved surface treatment."
        highlightedCellIds={new Set<string>()}
        selectedCellId={null}
        locateTargetCellId={canonicalReservedCellIdStory}
      />
    </div>
  )
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

export const ViewVsStorageParity: Story = {
  render: () => (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-3">
        <ProofShellLabel
          title="View"
          description="Read-only shell. Same base and occupied fill as storage."
        />
        <WarehouseScenarioComposer
          occupiedCellIds={canonicalOccupiedCellIdsStory}
          cellRuntimeById={canonicalOccupiedCellRuntimeByIdStory}
          panel={<EmptyReadOnlyPanel />}
        />
      </div>
      <div className="space-y-3">
        <ProofShellLabel
          title="Storage"
          description="Operational shell. Same base and occupied fill, with panel behavior only changing around the canvas."
        />
        <WarehouseScenarioComposer
          occupiedCellIds={canonicalOccupiedCellIdsStory}
          cellRuntimeById={canonicalOccupiedCellRuntimeByIdStory}
          selectedCellId={canonicalSelectedCellIdStory}
          panel={<StoragePanel />}
        />
      </div>
    </div>
  )
};
