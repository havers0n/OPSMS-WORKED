import { Lock } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Badge } from '@/shared/ui/badge';

type WorkspaceStatusBadgeProps = {
  variant: 'badge';
  label: string;
  isCurrentModeLocked: boolean;
  style: CSSProperties;
  tooltip: string | null;
};

type WorkspaceStatusInlineProps = {
  variant: 'inline';
  message: string | null;
};

type WorkspaceStatusProps = WorkspaceStatusBadgeProps | WorkspaceStatusInlineProps;

export function WorkspaceStatus(props: WorkspaceStatusProps) {
  if (props.variant === 'inline') {
    if (!props.message) {
      return null;
    }

    return (
      <span className="mr-2 text-[11px]" style={{ color: 'var(--text-muted)' }} aria-live="polite">
        {props.message}
      </span>
    );
  }

  return (
    <Badge
      className="group relative flex cursor-help items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={props.style}
    >
      {props.isCurrentModeLocked ? (
        <Lock className="h-3 w-3" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      )}
      {props.label}

      {props.tooltip && (
        <div className="absolute left-1/2 top-full z-50 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-[10px] text-white group-hover:block">
          {props.tooltip}
        </div>
      )}
    </Badge>
  );
}
