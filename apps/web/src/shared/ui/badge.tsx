import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  icon?: ReactNode;
  style?: CSSProperties;
};

const BASE_CLASSNAME =
  'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium';

const TONE_CLASSNAME: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  info: 'bg-blue-50 text-blue-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700'
};

function joinClassNames(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(' ');
}

export function Badge({
  tone = 'neutral',
  icon,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={joinClassNames(BASE_CLASSNAME, TONE_CLASSNAME[tone], className)} {...props}>
      {icon}
      {children}
    </span>
  );
}
