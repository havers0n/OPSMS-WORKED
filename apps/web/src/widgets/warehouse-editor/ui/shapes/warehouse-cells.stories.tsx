import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Cell, OperationsCellRuntime } from '@wos/domain';
import type { ReactNode } from 'react';
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

const proofSceneWidth = Math.ceil(pairedRackGeometryStory.width + 40);
const proofSceneHeight = Math.ceil(pairedRackGeometryStory.height + 40);

function renderCellProof(args: ProofArgs, options?: { scale?: number }) {
  const scale = options?.scale ?? 1;
  const scene = (
    <WarehouseScene width={proofSceneWidth} height={proofSceneHeight}>
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

  if (scale === 1) {
    return scene;
  }

  return (
    <div
      className="overflow-hidden"
      style={{
        width: Math.ceil(proofSceneWidth * scale),
        height: Math.ceil(proofSceneHeight * scale)
      }}
    >
      <div className="origin-top-left" style={{ transform: `scale(${scale})` }}>
        {scene}
      </div>
    </div>
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

function ProofComparisonCard({
  title,
  description,
  proof
}: {
  title: string;
  description: string;
  proof: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <ProofShellLabel title={title} description={description} />
      {proof}
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
  args: {
    geometry: pairedRackGeometryStory,
    rackId: pairedRackStory.id,
    faceA: faceAStory,
    faceB: faceBStory,
    isSelected: false,
    activeLevelIndex: 1,
    publishedCellsByStructure: publishedCellsByStructureStory,
    occupiedCellIds: canonicalOccupiedCellIdsStory,
    cellRuntimeById: canonicalOccupiedCellRuntimeByIdStory,
    highlightedCellIds: new Set<string>(),
    isInteractive: false,
    isWorkflowScope: false,
    isPassive: false,
    rackRotationDeg: 0,
    selectedCellId: null,
    locateTargetCellId: null,
    workflowSourceCellId: null,
    showCellNumbers: true,
    cellNumberProminence: 'dominant',
    showFocusedFullAddress: true
  },
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
  render: () => (
    <div className="space-y-4">
      <ProofShellLabel
        title="Degraded Truth"
        description="Comparison proof: degraded truth keeps the ordinary occupied fill and is distinguished only by an internal marker."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <ProofComparisonCard
          title="Ordinary Occupied"
          description="Authoritative runtime occupied cell, with no degraded marker."
          proof={renderCellProof(
            {
              publishedCellsByStructure: publishedCellsByStructureStory,
              occupiedCellIds: canonicalOccupiedCellIdsStory,
              cellRuntimeById: canonicalOccupiedCellRuntimeByIdStory,
              highlightedCellIds: new Set<string>(),
              selectedCellId: null,
              locateTargetCellId: null,
              workflowSourceCellId: null,
              isWorkflowScope: false,
              isSelected: false
            },
            { scale: 1.45 }
          )}
        />
        <ProofComparisonCard
          title="Degraded Truth"
          description="Fallback occupancy reuses occupied fill and proves uncertainty through the internal marker only."
          proof={renderCellProof(
            {
              publishedCellsByStructure: publishedCellsByStructureStory,
              occupiedCellIds: degradedOccupiedCellIdsStory,
              cellRuntimeById: degradedOccupiedCellRuntimeByIdStory,
              highlightedCellIds: new Set<string>(),
              selectedCellId: null,
              locateTargetCellId: null,
              workflowSourceCellId: null,
              isWorkflowScope: false,
              isSelected: false
            },
            { scale: 1.45 }
          )}
        />
      </div>
    </div>
  )
};

export const UnknownTruth: Story = {
  render: () => (
    <div className="space-y-4">
      <ProofShellLabel
        title="Unknown Truth"
        description="Comparison proof: unknown truth remains layout-like in fill/base and is distinguished only by an internal marker."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <ProofComparisonCard
          title="Layout Only"
          description="Pure structure with no storage truth marker."
          proof={renderCellProof(
            {
              publishedCellsByStructure: layoutOnlyPublishedCellsByStructureStory,
              occupiedCellIds: canonicalEmptyOccupiedCellIdsStory,
              cellRuntimeById: canonicalEmptyCellRuntimeByIdStory,
              highlightedCellIds: new Set<string>(),
              selectedCellId: null,
              locateTargetCellId: null,
              workflowSourceCellId: null,
              isWorkflowScope: false,
              isSelected: false
            },
            { scale: 1.45 }
          )}
        />
        <ProofComparisonCard
          title="Unknown Truth"
          description="No invented fill class; the proof signal comes from the internal unknown marker only."
          proof={renderCellProof(
            {
              publishedCellsByStructure: publishedCellsByStructureStory,
              occupiedCellIds: unknownTruthOccupiedCellIdsStory,
              cellRuntimeById: unknownTruthCellRuntimeByIdStory,
              highlightedCellIds: new Set<string>(),
              selectedCellId: null,
              locateTargetCellId: null,
              workflowSourceCellId: null,
              isWorkflowScope: false,
              isSelected: false
            },
            { scale: 1.45 }
          )}
        />
      </div>
    </div>
  )
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
