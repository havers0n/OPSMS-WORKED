import type { HTMLAttributes, ReactNode } from 'react';
import { Divider } from '@/shared/ui/divider';
import { ScrollArea } from '@/shared/ui/scroll-area';

type DrawerProps = HTMLAttributes<HTMLElement> & {
  header?: ReactNode;
  footer?: ReactNode;
  bodyClassName?: string;
};

function joinClassNames(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(' ');
}

export function Drawer({
  header,
  footer,
  className,
  bodyClassName,
  children,
  ...props
}: DrawerProps) {
  return (
    <aside
      className={joinClassNames(
        'flex h-full min-h-0 w-full max-w-sm flex-col border border-slate-200 bg-white',
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
      <ScrollArea className={joinClassNames('flex-1 px-4 py-3', bodyClassName)}>{children}</ScrollArea>
      {footer && (
        <>
          <Divider />
          <div className="px-4 py-3">{footer}</div>
        </>
      )}
    </aside>
  );
}
