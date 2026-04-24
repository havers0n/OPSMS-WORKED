import type { Meta, StoryObj } from '@storybook/react-vite';
import { CellOverviewPanel } from './cell-overview-panel';
import { ContainerDetailPanel } from './container-detail-panel';
import {
  containerStorageRowsStory,
  groupedContainersStory,
  inventoryPreviewRowsStory,
  selectedProductStory
} from '@/storybook/warehouse/warehouse-story-fixtures';

function CellOverviewShowcase() {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="h-[42rem]">
        <CellOverviewPanel
          rackDisplayCode="R-14"
          activeLevel={2}
          locationCode="R-14-A.01.02.02"
          isOccupied={true}
          locationType="rack_cell"
          containers={groupedContainersStory}
          inventoryPreviewRows={inventoryPreviewRowsStory}
          inventoryOverflow={2}
          onSelectContainer={() => undefined}
          onOpenCreateTask={() => undefined}
          onOpenCreateWithProductTask={() => undefined}
        />
      </div>
      <div className="h-[42rem]">
        <CellOverviewPanel
          rackDisplayCode="R-03"
          activeLevel={1}
          locationCode="R-03-A.01.01.01"
          isOccupied={false}
          locationType="rack_cell"
          containers={[]}
          inventoryPreviewRows={[]}
          inventoryOverflow={0}
          onSelectContainer={() => undefined}
          onOpenCreateTask={() => undefined}
          onOpenCreateWithProductTask={() => undefined}
        />
      </div>
    </div>
  );
}

const meta = {
  title: 'Warehouse/Reference/Containers/Storage Panels',
  component: CellOverviewPanel,
  parameters: {
    layout: 'fullscreen'
  },
  render: () => <CellOverviewShowcase />
} satisfies Meta<typeof CellOverviewPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    rackDisplayCode: 'R-14',
    activeLevel: 2,
    locationCode: 'R-14-A.01.02.02',
    isOccupied: true,
    locationType: 'rack_slot',
    containers: groupedContainersStory,
    inventoryPreviewRows: inventoryPreviewRowsStory,
    inventoryOverflow: 2,
    onSelectContainer: () => undefined,
    onOpenCreateTask: () => undefined,
    onOpenCreateWithProductTask: () => undefined
  }
};

export const ContainerDetail: Story = {
  args: {
    rackDisplayCode: 'R-14',
    activeLevel: 2,
    locationCode: 'R-14-A.01.02.02',
    isOccupied: true,
    locationType: 'rack_slot',
    containers: groupedContainersStory,
    inventoryPreviewRows: inventoryPreviewRowsStory,
    inventoryOverflow: 2,
    onSelectContainer: () => undefined,
    onOpenCreateTask: () => undefined,
    onOpenCreateWithProductTask: () => undefined
  },
  render: () => (
    <div className="h-[42rem]">
      <ContainerDetailPanel
        rackDisplayCode="R-14"
        activeLevel={2}
        locationCode="R-14-A.01.02.02"
        displayCode="PAL-A19"
        firstRow={containerStorageRowsStory[0]}
        items={containerStorageRowsStory.slice(0, 2)}
        selectedProduct={selectedProductStory}
        structuralDefaultText="Primary pick"
        effectiveRoleText="Reserve override"
        sourceText="Product-specific override"
        hasProductContext={true}
        isConflict={false}
        showNoneExplanation={false}
        canShowOverrideEntry={true}
        hasExplicitOverride={true}
        canShowRepairConflictEntry={false}
        isEmptyContainer={false}
        onBack={() => undefined}
        onOpenEditOverrideTask={() => undefined}
        onOpenRepairConflictTask={() => undefined}
        onOpenAddProductTask={() => undefined}
        onOpenTransferToContainerTask={() => undefined}
        onOpenExtractQuantityTask={() => undefined}
        onOpenRemoveContainerTask={() => undefined}
        onStartMoveContainer={() => undefined}
      />
    </div>
  )
};

export const ConflictRepairPanel: Story = {
  args: {
    rackDisplayCode: 'R-14',
    activeLevel: 2,
    locationCode: 'R-14-A.01.02.02',
    isOccupied: true,
    locationType: 'rack_slot',
    containers: groupedContainersStory,
    inventoryPreviewRows: inventoryPreviewRowsStory,
    inventoryOverflow: 2,
    onSelectContainer: () => undefined,
    onOpenCreateTask: () => undefined,
    onOpenCreateWithProductTask: () => undefined
  },
  render: () => (
    <div className="h-[42rem]">
      <ContainerDetailPanel
        rackDisplayCode="R-14"
        activeLevel={2}
        locationCode="R-14-A.01.02.02"
        displayCode="CNT-00911"
        firstRow={containerStorageRowsStory[2]}
        items={[]}
        selectedProduct={null}
        structuralDefaultText="None"
        effectiveRoleText="Conflict"
        sourceText="Multiple published overrides"
        hasProductContext={false}
        isConflict={true}
        showNoneExplanation={true}
        canShowOverrideEntry={false}
        hasExplicitOverride={false}
        canShowRepairConflictEntry={true}
        isEmptyContainer={true}
        onBack={() => undefined}
        onOpenEditOverrideTask={() => undefined}
        onOpenRepairConflictTask={() => undefined}
        onOpenAddProductTask={() => undefined}
        onOpenTransferToContainerTask={() => undefined}
        onOpenExtractQuantityTask={() => undefined}
        onOpenRemoveContainerTask={() => undefined}
        onStartMoveContainer={() => undefined}
      />
    </div>
  )
};
