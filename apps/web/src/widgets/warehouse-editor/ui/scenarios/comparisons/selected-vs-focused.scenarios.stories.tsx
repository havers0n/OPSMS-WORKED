import type { Meta, StoryObj } from '@storybook/react-vite';
import { WarehouseScenarioComposer } from '@/storybook/warehouse/warehouse-scenario-composer';
import { scenarioSelectedCellIdStory } from '@/storybook/warehouse/warehouse-story-fixtures';

function SemanticLegend() {
  const items = [
    {
      label: 'Selected',
      description: 'Strongest active structural emphasis.',
      fill: 'var(--wh-selected-fill)',
      border: 'var(--wh-selected-border)',
      text: 'var(--wh-selected-text)'
    },
    {
      label: 'Focused',
      description: 'Softer transient attention without selected strength.',
      fill: 'var(--wh-focused-fill)',
      border: 'var(--wh-focused-border)',
      text: 'var(--wh-focused-text)'
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
          Selected vs focused
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

function SelectedVsFocusedScene() {
  return (
    <div className="space-y-4">
      <SemanticLegend />
      <div className="grid gap-4 xl:grid-cols-2">
        <div>
          <div
            className="mb-2 text-xs font-semibold uppercase tracking-[0.12em]"
            style={{ color: 'var(--wh-selected-text)' }}
          >
            Selected
          </div>
          <WarehouseScenarioComposer
            selectedCellId={scenarioSelectedCellIdStory}
            showFocusedFullAddress={false}
          />
        </div>
        <div>
          <div
            className="mb-2 text-xs font-semibold uppercase tracking-[0.12em]"
            style={{ color: 'var(--wh-focused-text)' }}
          >
            Focused
          </div>
          <WarehouseScenarioComposer
            selectedCellId={scenarioSelectedCellIdStory}
            showFocusedFullAddress={true}
          />
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

export const SelectedVsFocused: Story = {
  render: () => <SelectedVsFocusedScene />,
  parameters: {
    docs: {
      description: {
        story: 'Foundational comparison for the selected and focused navigation channels.'
      }
    }
  }
};
