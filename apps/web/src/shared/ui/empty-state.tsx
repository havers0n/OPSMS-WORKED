import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

function joinClassNames(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(' ');
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={joinClassNames('flex flex-1 flex-col items-center justify-center px-8 text-center', className)}
    >
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {description && <p className="mt-1 text-xs leading-relaxed text-gray-500">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
