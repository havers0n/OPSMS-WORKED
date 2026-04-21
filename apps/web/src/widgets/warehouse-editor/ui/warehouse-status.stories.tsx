import type { Meta, StoryObj } from '@storybook/react-vite';
import { RackStatusSummary } from '@/entities/rack/ui/rack-status-summary';
import { CellStatusChip } from '@/entities/cell/ui/cell-status-chip';
import { PolicyLegendVisual } from './rack-inspector/policy-legend-visual';
import { SlotDirectionVisual } from './rack-inspector/slot-direction-visual';
import { faceAStory } from '@/storybook/warehouse/warehouse-story-fixtures';

function StatusShowcase() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Cell status
          </div>
          <div className="flex flex-wrap gap-3">
            <CellStatusChip occupied={false} />
            <CellStatusChip occupied={true} />
          </div>
        </div>
        <RackStatusSummary
          displayCode="R-14"
          kind="paired"
          axis="horizontal"
          occupancySummary={{
            occupancyRate: 0.58,
            occupiedCells: 14,
            totalCells: 24
          }}
          levels={[
            { levelOrdinal: 3, occupiedCells: 2, totalCells: 8 },
            { levelOrdinal: 2, occupiedCells: 8, totalCells: 8 },
            { levelOrdinal: 1, occupiedCells: 4, totalCells: 8 }
          ]}
        />
      </div>
      <div className="space-y-4">
        <PolicyLegendVisual />
        <SlotDirectionVisual
          rackId="rack-story"
          side="A"
          face={faceAStory}
          onUpdate={() => undefined}
        />
      </div>
    </div>
  );
}

const meta = {
  title: 'Warehouse/Status/Indicators',
  component: RackStatusSummary,
  parameters: {
    layout: 'padded'
  },
  render: () => <StatusShowcase />
} satisfies Meta<typeof RackStatusSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    displayCode: 'R-14',
    kind: 'paired',
    axis: 'WE',
    occupancySummary: {
      occupancyRate: 0.58,
      occupiedCells: 14,
      totalCells: 24
    },
    levels: [
      { levelOrdinal: 3, occupiedCells: 2, totalCells: 8 },
      { levelOrdinal: 2, occupiedCells: 8, totalCells: 8 },
      { levelOrdinal: 1, occupiedCells: 4, totalCells: 8 }
    ]
  }
};

export const Empty: Story = {
  args: {
    displayCode: 'R-02',
    kind: 'single',
    axis: 'WE',
    occupancySummary: {
      occupancyRate: 0,
      occupiedCells: 0,
      totalCells: 12
    },
    levels: [
      { levelOrdinal: 3, occupiedCells: 0, totalCells: 4 },
      { levelOrdinal: 2, occupiedCells: 0, totalCells: 4 },
      { levelOrdinal: 1, occupiedCells: 0, totalCells: 4 }
    ]
  },
  render: () => (
    <RackStatusSummary
      displayCode="R-02"
      kind="single"
      axis="horizontal"
      occupancySummary={{
        occupancyRate: 0,
        occupiedCells: 0,
        totalCells: 12
      }}
      levels={[
        { levelOrdinal: 3, occupiedCells: 0, totalCells: 4 },
        { levelOrdinal: 2, occupiedCells: 0, totalCells: 4 },
        { levelOrdinal: 1, occupiedCells: 0, totalCells: 4 }
      ]}
    />
  )
};

export const WarningAndReadOnly: Story = {
  args: {
    displayCode: 'R-14',
    kind: 'paired',
    axis: 'WE',
    occupancySummary: {
      occupancyRate: 0.58,
      occupiedCells: 14,
      totalCells: 24
    },
    levels: [
      { levelOrdinal: 3, occupiedCells: 2, totalCells: 8 },
      { levelOrdinal: 2, occupiedCells: 8, totalCells: 8 },
      { levelOrdinal: 1, occupiedCells: 4, totalCells: 8 }
    ]
  },
  render: () => (
    <div className="grid gap-4 md:grid-cols-2">
      <PolicyLegendVisual />
      <SlotDirectionVisual
        rackId="rack-story"
        side="A"
        face={faceAStory}
        disabled={true}
        onUpdate={() => undefined}
      />
    </div>
  )
};
