export interface OccupancyBarProps {
  rate: number;
  label?: string;
}

export function OccupancyBar({ rate, label }: OccupancyBarProps) {
  const pct = Math.round(rate * 100);
  const displayLabel = label ?? `${pct}%`;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 tabular-nums w-8 text-right">{displayLabel}</span>
    </div>
  );
}
