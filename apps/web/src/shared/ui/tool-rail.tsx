import type { HTMLAttributes } from 'react';

type ToolRailOrientation = 'horizontal' | 'vertical';

type ToolRailProps = HTMLAttributes<HTMLDivElement> & {
  orientation?: ToolRailOrientation;
};

function joinClassNames(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(' ');
}

const ORIENTATION_CLASSNAME: Record<ToolRailOrientation, string> = {
  horizontal: 'flex-row items-center',
  vertical: 'flex-col items-center'
};

export function ToolRail({
  orientation = 'vertical',
  className,
  children,
  ...props
}: ToolRailProps) {
  return (
    <div
      role="toolbar"
      aria-orientation={orientation}
      className={joinClassNames(
        'inline-flex gap-2 rounded-md border border-slate-200 bg-white p-2',
        ORIENTATION_CLASSNAME[orientation],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
