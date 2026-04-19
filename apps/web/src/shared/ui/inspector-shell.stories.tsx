import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '@/shared/ui/badge';
import { InspectorShell } from '@/shared/ui/inspector-shell';
import { Section } from '@/shared/ui/section';

const meta = {
  title: 'Shared UI/InspectorShell',
  component: InspectorShell
} satisfies Meta<typeof InspectorShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: () => (
    <div className="h-96">
      <InspectorShell
        header={<p className="text-sm font-semibold text-slate-900">Inspector</p>}
        footer={<Badge tone="neutral">Read-only</Badge>}
      >
        <Section title="Summary">
          <p className="text-sm text-slate-700">Neutral stack section.</p>
        </Section>
        <Section title="Details">
          <p className="text-sm text-slate-700">Additional neutral block.</p>
        </Section>
      </InspectorShell>
    </div>
  )
};
