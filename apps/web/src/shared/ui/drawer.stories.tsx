import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/shared/ui/button';
import { Drawer } from '@/shared/ui/drawer';

const meta = {
  title: 'Shared UI/Drawer',
  component: Drawer,
  args: {
    header: <p className="text-sm font-semibold">Drawer header</p>,
    footer: <Button variant="solid">Primary action</Button>
  }
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: (args) => (
    <div className="h-80">
      <Drawer {...args}>
        <div className="space-y-2 text-sm text-slate-700">
          {Array.from({ length: 10 }, (_, index) => (
            <p key={index}>Scrollable drawer content row {index + 1}</p>
          ))}
        </div>
      </Drawer>
    </div>
  )
};
