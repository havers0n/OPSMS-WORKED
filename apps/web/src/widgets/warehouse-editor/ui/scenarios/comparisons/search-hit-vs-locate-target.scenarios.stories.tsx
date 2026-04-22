import type { Meta, StoryObj } from '@storybook/react-vite';
import { WarehouseScenarioComposer } from '@/storybook/warehouse/warehouse-scenario-composer';
import {
  scenarioLocateTargetCellIdStory,
  scenarioSearchSingleHitCellIdsStory
} from '@/storybook/warehouse/warehouse-story-fixtures';

function SearchVsLocateLegend() {
  const items = [
    {
      label: 'Search hit',
      description: 'Discovery emphasis. Present, but weaker than destination emphasis.',
      fill: 'var(--wh-search-hit-fill)',
      border: 'var(--wh-search-hit-border)',
      text: 'var(--wh-search-hit-text)'
    },
    {
      label: 'Locate target',
      description: 'Explicit destination emphasis. Stronger and more directive than search.',
      fill: 'var(--wh-locate-target-fill)',
      border: 'var(--wh-locate-target-border)',
      text: 'var(--wh-locate-target-text)'
    }
  ];

  return (
    <div
      className="rounded-2xl border p-4"
      style={{ background: 'var(--wh-surface)', borderColor: 'var(--wh-border)' }}
    >
      <div className="mb-3">
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: 'var(--wh-text-muted)' }}
        >
          Semantic Vocabulary
        </div>
        <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--wh-text-primary)' }}>
          Search hit vs locate target
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border p-3"
            style={{ background: item.fill, borderColor: item.border }}
          >
            <div className="text-sm font-semibold" style={{ color: item.text }}>
              {item.label}
            </div>
            <div className="mt-1 text-xs leading-5" style={{ color: 'var(--wh-text-secondary)' }}>
              {item.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchHitVsLocateTargetScene() {
  return (
    <div className="space-y-4">
      <SearchVsLocateLegend />
      <div className="grid gap-4 xl:grid-cols-2">
        <div>
          <div
            className="mb-2 text-xs font-semibold uppercase tracking-[0.12em]"
            style={{ color: 'var(--wh-search-hit-text)' }}
          >
            Search hit
          </div>
          <WarehouseScenarioComposer highlightedCellIds={scenarioSearchSingleHitCellIdsStory} />
        </div>
        <div>
          <div
            className="mb-2 text-xs font-semibold uppercase tracking-[0.12em]"
            style={{ color: 'var(--wh-locate-target-text)' }}
          >
            Locate target
          </div>
          <WarehouseScenarioComposer workflowSourceCellId={scenarioLocateTargetCellIdStory} />
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: 'Warehouse/Scenarios/Comparisons',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const SearchHitVsLocateTarget: Story = {
  render: () => <SearchHitVsLocateTargetScene />
};
