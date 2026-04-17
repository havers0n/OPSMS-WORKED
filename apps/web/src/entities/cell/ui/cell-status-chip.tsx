export interface CellStatusChipProps {
  occupied: boolean;
}

export function CellStatusChip({ occupied }: CellStatusChipProps) {
  if (occupied) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium bg-red-50 text-red-700 border-red-200">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-red-500" />
        Occupied
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium bg-green-50 text-green-700 border-green-200">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-green-500" />
      Empty
    </span>
  );
}
