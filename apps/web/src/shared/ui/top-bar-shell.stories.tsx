import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { TopBarShell } from '@/shared/ui/top-bar-shell';

const meta = {
  title: 'Shared UI/TopBarShell',
  component: TopBarShell
} satisfies Meta<typeof TopBarShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: () => (
    <TopBarShell
      left={<p className="truncate text-sm font-medium text-slate-800">Workspace</p>}
      center={<Badge tone="info">Live</Badge>}
      right={
        <div className="flex items-center gap-2">
          <Button size="sm">Secondary</Button>
          <Button variant="solid">Primary</Button>
        </div>
      }
    />
  )
};
