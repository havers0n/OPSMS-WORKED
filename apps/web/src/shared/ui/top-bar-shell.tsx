import type { HTMLAttributes, ReactNode } from 'react';
import { Divider } from '@/shared/ui/divider';

type TopBarShellProps = HTMLAttributes<HTMLElement> & {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
};

function joinClassNames(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(' ');
}

export function TopBarShell({ left, center, right, className, ...props }: TopBarShellProps) {
  return (
    <header className={joinClassNames('bg-white', className)} {...props}>
      <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center gap-3 px-4">
        <div className="min-w-0">{left}</div>
        <div className="min-w-0 text-center">{center}</div>
        <div className="flex min-w-0 items-center justify-end">{right}</div>
      </div>
      <Divider />
    </header>
  );
}
