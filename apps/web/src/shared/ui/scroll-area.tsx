import type { HTMLAttributes } from 'react';

type ScrollAreaProps = HTMLAttributes<HTMLDivElement>;

function joinClassNames(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(' ');
}

export function ScrollArea({ className, children, ...props }: ScrollAreaProps) {
  return (
    <div className={joinClassNames('min-h-0 min-w-0 overflow-auto', className)} {...props}>
      {children}
    </div>
  );
}
