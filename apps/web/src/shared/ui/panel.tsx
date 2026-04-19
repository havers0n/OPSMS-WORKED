import type { HTMLAttributes } from 'react';

type PanelTone = 'default' | 'muted';
type PanelPadding = 'none' | 'sm' | 'md';

type PanelProps = HTMLAttributes<HTMLDivElement> & {
  tone?: PanelTone;
  padding?: PanelPadding;
};

function joinClassNames(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(' ');
}

const TONE_CLASSNAME: Record<PanelTone, string> = {
  default: 'bg-white',
  muted: 'bg-slate-50'
};

const PADDING_CLASSNAME: Record<PanelPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4'
};

export function Panel({
  tone = 'default',
  padding = 'md',
  className,
  children,
  ...props
}: PanelProps) {
  return (
    <section
      className={joinClassNames(
        'rounded-lg border border-slate-200 text-slate-900',
        TONE_CLASSNAME[tone],
        PADDING_CLASSNAME[padding],
        className
      )}
      {...props}
    >
      {children}
    </section>
  );
}
