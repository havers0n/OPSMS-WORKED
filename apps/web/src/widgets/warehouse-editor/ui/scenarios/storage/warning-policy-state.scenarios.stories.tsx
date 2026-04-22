import type { Meta, StoryObj } from '@storybook/react-vite';
import { WarehouseScenarioComposer } from '@/storybook/warehouse/warehouse-scenario-composer';
import { scenarioStorageWarningPolicyContextStory } from '@/storybook/warehouse/warehouse-story-fixtures';
import { StorageLocationSectionsPanel } from '../scenario-panels';

function SemanticStateRow({
  label,
  description,
  fill,
  border,
  text
}: {
  label: string;
  description: string;
  fill: string;
  border: string;
  text: string;
}) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{ background: fill, borderColor: border }}
    >
      <div className="text-sm font-semibold" style={{ color: text }}>
        {label}
      </div>
      <div className="mt-1 text-xs leading-5" style={{ color: 'var(--wh-text-secondary)' }}>
        {description}
      </div>
    </div>
  );
}

function WarningPolicyComparisonPanel() {
  return (
    <div className="w-full space-y-3 p-3">
      <div
        className="rounded-2xl border p-4"
        style={{ background: 'var(--wh-surface)', borderColor: 'var(--wh-border)' }}
      >
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: 'var(--wh-text-muted)' }}
        >
          Problem vs Navigation
        </div>
        <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--wh-text-primary)' }}>
          Problem semantics stay distinct from navigation emphasis on canvas.
        </div>
        <div className="mt-3 grid gap-3">
          <SemanticStateRow
            label="Selected"
            description="Navigation emphasis for the active structural context."
            fill="var(--wh-selected-fill)"
            border="var(--wh-selected-border)"
            text="var(--wh-selected-text)"
          />
          <SemanticStateRow
            label="Warning"
            description="Cautionary signal. Operational concern, not navigation."
            fill="var(--wh-warning-fill)"
            border="var(--wh-warning-border)"
            text="var(--wh-warning-text)"
          />
          <SemanticStateRow
            label="Conflict"
            description="Problem state requiring resolution. Stronger than warning."
            fill="var(--wh-conflict-fill)"
            border="var(--wh-conflict-border)"
            text="var(--wh-conflict-text)"
          />
          <SemanticStateRow
            label="Override"
            description="Policy exception state. Distinct from warning and conflict."
            fill="var(--wh-override-fill)"
            border="var(--wh-override-border)"
            text="var(--wh-override-text)"
          />
        </div>
      </div>

      <StorageLocationSectionsPanel
        containers={scenarioStorageWarningPolicyContextStory.containers}
        sourceCellId={scenarioStorageWarningPolicyContextStory.selectedCellId}
        inventoryItems={scenarioStorageWarningPolicyContextStory.inventoryItems}
        hasContainers={scenarioStorageWarningPolicyContextStory.hasContainers}
        policyAssignments={scenarioStorageWarningPolicyContextStory.policyAssignments}
        policyPending={scenarioStorageWarningPolicyContextStory.policyPending}
      />
    </div>
  );
}

const meta = {
  title: 'Warehouse/Scenarios/Storage',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WarningPolicyState: Story = {
  render: () => (
    <WarehouseScenarioComposer
      selectedCellId={scenarioStorageWarningPolicyContextStory.selectedCellId}
      panel={<WarningPolicyComparisonPanel />}
    />
  )
};
