import type { HTMLAttributes, ReactNode } from 'react';
import { Divider } from '@/shared/ui/divider';
import { ScrollArea } from '@/shared/ui/scroll-area';

type InspectorShellProps = HTMLAttributes<HTMLElement> & {
  header?: ReactNode;
  footer?: ReactNode;
  contentClassName?: string;
};

function joinClassNames(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(' ');
}

export function InspectorShell({
  header,
  footer,
  contentClassName,
  className,
  children,
  ...props
}: InspectorShellProps) {
  return (
    <aside
      className={joinClassNames(
        'flex h-full min-h-0 flex-col rounded-md border border-slate-200 bg-slate-50',
        className
      )}
      {...props}
    >
      {header && (
        <>
          <div className="px-4 py-3">{header}</div>
          <Divider />
        </>
      )}
      <ScrollArea className={joinClassNames('flex-1 space-y-3 px-3 py-3', contentClassName)}>
        {children}
      </ScrollArea>
      {footer && (
        <>
          <Divider />
          <div className="px-4 py-3">{footer}</div>
        </>
      )}
    </aside>
  );
}
