import type { HTMLAttributes, ReactNode } from 'react';
import { Divider } from '@/shared/ui/divider';

type SectionProps = HTMLAttributes<HTMLElement> & {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  bodyClassName?: string;
};

function joinClassNames(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(' ');
}

export function Section({
  title,
  subtitle,
  action,
  footer,
  className,
  bodyClassName,
  children,
  ...props
}: SectionProps) {
  const hasHeader = Boolean(title || subtitle || action);

  return (
    <section className={joinClassNames('rounded-md border border-slate-200 bg-white', className)} {...props}>
      {hasHeader && (
        <>
          <header className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
              {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </header>
          <Divider />
        </>
      )}
      <div className={joinClassNames('px-4 py-3', bodyClassName)}>{children}</div>
      {footer && (
        <>
          <Divider />
          <footer className="px-4 py-3">{footer}</footer>
        </>
      )}
    </section>
  );
}
