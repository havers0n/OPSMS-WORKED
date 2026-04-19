import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/shared/ui/button';
import { Section } from '@/shared/ui/section';

const meta = {
  title: 'Shared UI/Section',
  component: Section,
  args: {
    title: 'Section title',
    subtitle: 'Optional subtitle'
  }
} satisfies Meta<typeof Section>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: (args) => (
    <Section {...args}>
      <p className="text-sm text-slate-700">Section body content</p>
    </Section>
  )
};

export const WithActionAndFooter: Story = {
  render: (args) => (
    <Section
      {...args}
      action={<Button size="sm">Edit</Button>}
      footer={<p className="text-xs text-slate-500">Last updated 2 min ago</p>}
    >
      <p className="text-sm text-slate-700">Neutral content block with optional slots.</p>
    </Section>
  )
};
