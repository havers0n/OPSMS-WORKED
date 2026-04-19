import type { HTMLAttributes } from 'react';

type DividerOrientation = 'horizontal' | 'vertical';

type DividerProps = HTMLAttributes<HTMLDivElement> & {
  orientation?: DividerOrientation;
};

function joinClassNames(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(' ');
}

const ORIENTATION_CLASSNAME: Record<DividerOrientation, string> = {
  horizontal: 'h-px w-full',
  vertical: 'h-full w-px'
};

export function Divider({ orientation = 'horizontal', className, ...props }: DividerProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={joinClassNames('shrink-0 bg-slate-200', ORIENTATION_CLASSNAME[orientation], className)}
      {...props}
    />
  );
}
