import type { Meta, StoryObj } from '@storybook/react-vite';
import { WarehouseScenarioComposer } from '@/storybook/warehouse/warehouse-scenario-composer';
import {
  canonicalLocateTargetCellIdStory,
  canonicalOccupiedCellRuntimeByIdStory,
  canonicalOccupiedCellIdsStory,
  canonicalSearchHitAndLocateCellIdsStory
} from '@/storybook/warehouse/warehouse-story-fixtures';

function ProofLabel({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</div>
      <div className="text-sm text-slate-700">{description}</div>
    </div>
  );
}

function SearchHitVsLocateTargetProofScene() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-3">
        <ProofLabel
          title="Search Hits"
          description="Multiple matches share the weaker discovery halo."
        />
        <WarehouseScenarioComposer
          occupiedCellIds={canonicalOccupiedCellIdsStory}
          cellRuntimeById={canonicalOccupiedCellRuntimeByIdStory}
          highlightedCellIds={canonicalSearchHitAndLocateCellIdsStory}
        />
      </div>
      <div className="space-y-3">
        <ProofLabel
          title="Locate Target"
          description="The locate target keeps the stronger destination halo and suppresses the search-hit halo on that cell."
        />
        <WarehouseScenarioComposer
          occupiedCellIds={canonicalOccupiedCellIdsStory}
          cellRuntimeById={canonicalOccupiedCellRuntimeByIdStory}
          highlightedCellIds={canonicalSearchHitAndLocateCellIdsStory}
          locateTargetCellId={canonicalLocateTargetCellIdStory}
        />
      </div>
    </div>
  );
}

const meta = {
  title: 'Warehouse/Proof/Overlays',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const SearchHitVsLocateTargetProof: Story = {
  render: () => <SearchHitVsLocateTargetProofScene />
};
