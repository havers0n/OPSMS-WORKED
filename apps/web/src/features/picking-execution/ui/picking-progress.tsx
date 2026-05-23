export function PickingProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="text-xs font-semibold text-slate-600" data-testid="picking-run-progress">
      {current} / {total}
    </div>
  );
}
