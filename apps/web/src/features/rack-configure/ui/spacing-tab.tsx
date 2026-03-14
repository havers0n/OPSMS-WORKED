import {
  useAlignRacksHorizontal,
  useAlignRacksVertical,
  useDistributeRacksEqual,
  useIsLayoutEditable,
  useLayoutDraftState,
  useMinRackDistance,
  useSelectedRackIds,
  useSetMinRackDistance
} from '@/entities/layout-version/model/editor-selectors';

export function SpacingTab() {
  const selectedRackIds = useSelectedRackIds();
  const minRackDistance = useMinRackDistance();
  const setMinRackDistance = useSetMinRackDistance();
  const alignHorizontal = useAlignRacksHorizontal();
  const alignVertical = useAlignRacksVertical();
  const distributeEqual = useDistributeRacksEqual();
  const draft = useLayoutDraftState();
  const isLayoutEditable = useIsLayoutEditable();

  if (!draft) {
    return <div className="p-4 text-sm text-slate-500">No layout loaded</div>;
  }

  const selectedRacks = selectedRackIds.map((id) => draft.racks[id]).filter(Boolean);
  const hasMultipleSelected = selectedRacks.length > 1;

  return (
    <section className="grid gap-4">
      <div className="rounded-[18px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-5">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Spacing
        </h2>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm text-slate-700">Minimum Distance (m)</label>
            <div className="flex gap-2">
              <input
                disabled={!isLayoutEditable}
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={minRackDistance}
                onChange={(event) => setMinRackDistance(Number(event.target.value))}
                className="flex-1 disabled:cursor-not-allowed"
              />
              <input
                disabled={!isLayoutEditable}
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={minRackDistance.toFixed(2)}
                onChange={(event) => setMinRackDistance(Number(event.target.value) || 0)}
                className="w-16 rounded-lg border border-[var(--border-muted)] bg-white px-2 py-1 text-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
            <p className="text-xs text-slate-500">Racks cannot be closer than this distance</p>
          </div>

          {selectedRackIds.length > 0 && (
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="mb-2 text-xs font-medium text-slate-600">
                Selected Racks ({selectedRackIds.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedRacks.map((rack) => (
                  <span
                    key={rack.id}
                    className="inline-block rounded bg-blue-100 px-2 py-1 text-xs text-blue-900"
                  >
                    {rack.displayCode}
                  </span>
                ))}
              </div>
            </div>
          )}

          {hasMultipleSelected && (
            <div className="grid gap-3">
              <p className="text-xs font-medium text-slate-600">Alignment</p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!isLayoutEditable}
                  onClick={() => alignHorizontal(selectedRackIds)}
                  className="rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  Align Horizontal
                </button>
                <button
                  type="button"
                  disabled={!isLayoutEditable}
                  onClick={() => alignVertical(selectedRackIds)}
                  className="rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  Align Vertical
                </button>
              </div>

              <p className="text-xs font-medium text-slate-600">Distribution</p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!isLayoutEditable}
                  onClick={() => distributeEqual(selectedRackIds, 'x')}
                  className="rounded-lg bg-purple-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  Distribute Horizontal
                </button>
                <button
                  type="button"
                  disabled={!isLayoutEditable}
                  onClick={() => distributeEqual(selectedRackIds, 'y')}
                  className="rounded-lg bg-purple-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  Distribute Vertical
                </button>
              </div>
            </div>
          )}

          {selectedRackIds.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-500">
              Select racks on the canvas to configure spacing
            </p>
          )}
        </div>
      </div>

      <div className="rounded-[18px] border border-[var(--border-muted)] bg-white p-4 text-sm text-slate-700 shadow-sm">
        <p className="mb-2 font-medium">{isLayoutEditable ? 'Tips:' : 'Read-only:'}</p>
        {isLayoutEditable ? (
          <ul className="space-y-1 text-xs text-slate-600">
            <li>Use Ctrl+Click on canvas to select multiple racks</li>
            <li>Alignment snaps selected racks to a single line</li>
            <li>Distribution spreads racks equally while respecting minimum distance</li>
            <li>Drag racks near others to enable auto-snapping</li>
          </ul>
        ) : (
          <ul className="space-y-1 text-xs text-slate-600">
            <li>Published layouts can be inspected here</li>
            <li>Create a draft to change spacing and geometry</li>
          </ul>
        )}
      </div>
    </section>
  );
}
