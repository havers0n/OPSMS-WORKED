import {
  useSelectedRackIds,
  useMinRackDistance,
  useSetMinRackDistance,
  useAlignRacksHorizontal,
  useAlignRacksVertical,
  useDistributeRacksEqual,
  useLayoutDraftState
} from '@/entities/layout-version/model/editor-selectors';

export function SpacingTab() {
  const selectedRackIds = useSelectedRackIds();
  const minRackDistance = useMinRackDistance();
  const setMinRackDistance = useSetMinRackDistance();
  const alignHorizontal = useAlignRacksHorizontal();
  const alignVertical = useAlignRacksVertical();
  const distributeEqual = useDistributeRacksEqual();
  const draft = useLayoutDraftState();

  if (!draft) {
    return <div className="text-slate-500 text-sm p-4">No layout loaded</div>;
  }

  const selectedRacks = selectedRackIds.map(id => draft.racks[id]).filter(Boolean);
  const hasMultipleSelected = selectedRacks.length > 1;

  return (
    <section className="grid gap-4">
      <div className="rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-5">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Spacing
        </h2>

        <div className="grid gap-4">
          {/* Minimum Distance Control */}
          <div className="grid gap-2">
            <label className="text-sm text-slate-700">
              Minimum Distance (m)
            </label>
            <div className="flex gap-2">
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={minRackDistance}
                onChange={(e) => setMinRackDistance(Number(e.target.value))}
                className="flex-1"
              />
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={minRackDistance.toFixed(2)}
                onChange={(e) => setMinRackDistance(Number(e.target.value) || 0)}
                className="w-16 rounded-lg border border-[var(--border-muted)] bg-white px-2 py-1 text-sm"
              />
            </div>
            <p className="text-xs text-slate-500">
              Racks cannot be closer than this distance
            </p>
          </div>

          {/* Selected Racks Info */}
          {selectedRackIds.length > 0 && (
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-600 mb-2">
                Selected Racks ({selectedRackIds.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedRacks.map((rack) => (
                  <span
                    key={rack.id}
                    className="inline-block bg-blue-100 text-blue-900 text-xs px-2 py-1 rounded"
                  >
                    {rack.displayCode}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Alignment Controls - Only show for 2+ racks */}
          {hasMultipleSelected && (
            <div className="grid gap-3">
              <p className="text-xs font-medium text-slate-600">Alignment</p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => alignHorizontal(selectedRackIds)}
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 px-3 transition-colors"
                >
                  Align Horizontal
                </button>
                <button
                  onClick={() => alignVertical(selectedRackIds)}
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 px-3 transition-colors"
                >
                  Align Vertical
                </button>
              </div>

              <p className="text-xs font-medium text-slate-600">Distribution</p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => distributeEqual(selectedRackIds, 'x')}
                  className="rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium py-2.5 px-3 transition-colors"
                >
                  Distribute Horizontal
                </button>
                <button
                  onClick={() => distributeEqual(selectedRackIds, 'y')}
                  className="rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium py-2.5 px-3 transition-colors"
                >
                  Distribute Vertical
                </button>
              </div>
            </div>
          )}

          {selectedRackIds.length === 0 && (
            <p className="text-sm text-slate-500 py-4 text-center">
              Select racks on the canvas to configure spacing
            </p>
          )}
        </div>
      </div>

      <div className="rounded-[18px] border border-[var(--border-muted)] bg-white p-4 text-sm text-slate-700 shadow-sm">
        <p className="font-medium mb-2">Tips:</p>
        <ul className="text-xs space-y-1 text-slate-600">
          <li>• Use Ctrl+Click on canvas to select multiple racks</li>
          <li>• Alignment snaps selected racks to a single line</li>
          <li>• Distribution spreads racks equally while respecting minimum distance</li>
          <li>• Drag racks near others to enable auto-snapping</li>
        </ul>
      </div>
    </section>
  );
}
