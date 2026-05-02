import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { CanvasRect } from '@/entities/layout-version/lib/canvas-geometry';

type ViewportSize = {
  width: number;
  height: number;
};

type ObjectLocalAffordanceBarProps = {
  anchorRect: CanvasRect;
  viewport: ViewportSize;
  label?: string;
  children: ReactNode;
};

type ObjectLocalAffordanceButtonProps = {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'accent' | 'danger';
  disabled?: boolean;
  title?: string;
};

export function resolveObjectLocalAffordanceBarPosition({
  anchorRect,
  viewport,
  barSize,
  gap = 8,
  viewportPadding = 8
}: {
  anchorRect: CanvasRect;
  viewport: ViewportSize;
  barSize: { width: number; height: number };
  gap?: number;
  viewportPadding?: number;
}) {
  const anchorCenterX = anchorRect.x + anchorRect.width / 2;
  const minLeft = viewportPadding + barSize.width / 2;
  const maxLeft = Math.max(minLeft, viewport.width - viewportPadding - barSize.width / 2);
  const left = Math.min(maxLeft, Math.max(minLeft, anchorCenterX));

  const preferredTop = anchorRect.y - gap - barSize.height;
  const fallbackTop = anchorRect.y + anchorRect.height + gap;
  const maxTop = Math.max(viewportPadding, viewport.height - viewportPadding - barSize.height);
  const topCandidate =
    preferredTop >= viewportPadding || fallbackTop > maxTop ? preferredTop : fallbackTop;
  const top = Math.min(maxTop, Math.max(viewportPadding, topCandidate));

  return {
    left,
    top,
    transform: 'translateX(-50%)'
  };
}

export function ObjectLocalAffordanceBar({
  anchorRect,
  viewport,
  label,
  children
}: ObjectLocalAffordanceBarProps) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [barSize, setBarSize] = useState({ width: 220, height: 40 });

  useLayoutEffect(() => {
    const node = barRef.current;
    if (!node) return;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setBarSize({
        width: rect.width,
        height: rect.height
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);

    return () => observer.disconnect();
  }, [label, children]);

  const position = resolveObjectLocalAffordanceBarPosition({
    anchorRect,
    viewport,
    barSize
  });

  return (
    <div
      ref={barRef}
      className="pointer-events-auto absolute z-30 flex max-w-[min(320px,calc(100%-16px))] items-center gap-1 rounded-xl px-1.5 py-1 shadow-lg"
      style={{
        ...position,
        background: 'var(--surface-strong)',
        border: '1px solid var(--border-muted)',
        boxShadow: 'var(--shadow-panel)'
      }}
    >
      {label && (
        <>
          <span
            className="max-w-[120px] truncate px-1.5 font-mono text-[11px] font-semibold"
            style={{ color: 'var(--text-primary)' }}
            title={label}
          >
            {label}
          </span>
          <ObjectLocalAffordanceDivider />
        </>
      )}
      {children}
    </div>
  );
}

export function ObjectLocalAffordanceButton({
  icon: Icon,
  label,
  onClick,
  variant = 'default',
  disabled = false,
  title
}: ObjectLocalAffordanceButtonProps) {
  const color =
    variant === 'accent'
      ? 'var(--accent)'
      : variant === 'danger'
        ? 'var(--danger)'
        : 'var(--text-muted)';

  return (
    <button
      type="button"
      title={title ?? label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
      style={{ color }}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}

export function ObjectLocalAffordanceDivider() {
  return (
    <div
      className="mx-0.5 h-4 w-px"
      style={{ background: 'var(--border-muted)' }}
    />
  );
}
