import type { Meta, StoryObj } from '@storybook/react-vite';
import { WarehouseScenarioComposer } from '@/storybook/warehouse/warehouse-scenario-composer';
import {
  canonicalEmptyCellRuntimeByIdStory,
  canonicalEmptyOccupiedCellIdsStory,
  canonicalWorkflowSourceCellIdStory,
  degradedOccupiedCellIdsStory,
  degradedOccupiedCellRuntimeByIdStory
} from '@/storybook/warehouse/warehouse-story-fixtures';

function ProofLabel({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</div>
      <div className="text-sm text-slate-700">{description}</div>
    </div>
  );
}

function WorkflowMoveScene() {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-3">
        <ProofLabel
          title="Workflow Source"
          description="Workflow source uses the badge channel and leaves storage truth alone."
        />
        <WarehouseScenarioComposer
          occupiedCellIds={degradedOccupiedCellIdsStory}
          cellRuntimeById={degradedOccupiedCellRuntimeByIdStory}
          workflowSourceCellId={canonicalWorkflowSourceCellIdStory}
        />
      </div>
      <div className="space-y-3">
        <ProofLabel
          title="Valid Target"
          description="A valid target remains an ordinary empty cell. Workflow scope alone does not repaint fill."
        />
        <WarehouseScenarioComposer
          occupiedCellIds={canonicalEmptyOccupiedCellIdsStory}
          cellRuntimeById={canonicalEmptyCellRuntimeByIdStory}
          isWorkflowScope={true}
        />
      </div>
      <div className="space-y-3">
        <ProofLabel
          title="Invalid Target"
          description="Invalid target adds a badge only. The occupied fill stays storage-driven."
        />
        <WarehouseScenarioComposer
          occupiedCellIds={degradedOccupiedCellIdsStory}
          cellRuntimeById={degradedOccupiedCellRuntimeByIdStory}
          isWorkflowScope={true}
        />
      </div>
    </div>
  );
}

const meta = {
  title: 'Warehouse/Proof/Workflow',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WorkflowMoveProof: Story = {
  render: () => <WorkflowMoveScene />
};
