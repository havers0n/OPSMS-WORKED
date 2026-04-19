import type { Meta, StoryObj } from '@storybook/react-vite';
import { ScrollArea } from '@/shared/ui/scroll-area';

const meta = {
  title: 'Shared UI/ScrollArea',
  component: ScrollArea
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: () => (
    <div className="h-32 w-64 rounded-md border border-slate-200">
      <ScrollArea className="h-full p-3">
        <div className="space-y-2 text-xs text-slate-600">
          {Array.from({ length: 12 }, (_, index) => (
            <p key={index}>Scrollable neutral content row {index + 1}</p>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
};
