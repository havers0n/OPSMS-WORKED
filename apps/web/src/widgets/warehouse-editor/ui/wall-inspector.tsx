import type { FloorWorkspace, WallType } from '@wos/domain';
import { SlidersHorizontal, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  useDeleteWall,
  useIsLayoutEditable,
  useSelectedWallId,
  useUpdateWallDetails,
  useUpdateWallGeometry
} from '@/entities/layout-version/model/editor-selectors';
import { useWorkspaceLayout } from '../lib/use-workspace-layout';

const WALL_TYPE_OPTIONS: Array<{ value: WallType; label: string }> = [
  { value: 'generic', label: 'Generic' },
  { value: 'partition', label: 'Partition' },
  { value: 'safety', label: 'Safety' },
  { value: 'perimeter', label: 'Perimeter' },
  { value: 'custom', label: 'Custom' }
];

function parseCoordinateInput(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.round(parsed));
}

export function WallInspector({
  workspace,
  onClose
}: {
  workspace: FloorWorkspace | null;
  onClose: () => void;
}) {
  const layoutDraft = useWorkspaceLayout(workspace);
  const selectedWallId = useSelectedWallId();
  const updateWallDetails = useUpdateWallDetails();
  const updateWallGeometry = useUpdateWallGeometry();
  const deleteWall = useDeleteWall();
  const isLayoutEditable = useIsLayoutEditable();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const wall =
    layoutDraft && selectedWallId ? layoutDraft.walls[selectedWallId] ?? null : null;

  useEffect(() => {
    setConfirmingDelete(false);
  }, [selectedWallId]);

  if (!wall) {
    return (
      <aside className="flex h-full w-full flex-col bg-white">
        <div className="flex items-center justify-between border-b border-[var(--border-muted)] px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            Wall
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-400">
          Select a wall to inspect its properties.
        </div>
      </aside>
    );
  }

  const wallLength = Math.abs(wall.x2 - wall.x1) + Math.abs(wall.y2 - wall.y1);

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden bg-white">
      <div className="flex items-center justify-between border-b border-[var(--border-muted)] px-5 py-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              Wall
            </div>
            <div className="mt-0.5 text-sm font-semibold text-slate-800">
              {wall.code}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close inspector"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div className="rounded-xl border border-[var(--border-muted)] p-3">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Code
          </label>
          <input
            type="text"
            value={wall.code}
            disabled={!isLayoutEditable}
            onChange={(event) =>
              updateWallDetails(wall.id, {
                code: event.target.value.trimStart()
              })
            }
            className="mt-2 w-full rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-3 py-2 font-mono text-sm font-semibold text-slate-700 outline-none disabled:cursor-not-allowed disabled:opacity-70"
          />

          <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Name
          </label>
          <input
            type="text"
            value={wall.name ?? ''}
            disabled={!isLayoutEditable}
            onChange={(event) =>
              updateWallDetails(wall.id, {
                name: event.target.value.trimStart()
              })
            }
            placeholder="Optional wall name"
            className="mt-2 w-full rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-3 py-2 text-sm font-medium text-slate-700 outline-none disabled:cursor-not-allowed disabled:opacity-70"
          />

          <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Wall type
          </label>
          <select
            value={wall.wallType ?? ''}
            disabled={!isLayoutEditable}
            onChange={(event) =>
              updateWallDetails(wall.id, {
                wallType:
                  event.target.value === ''
                    ? null
                    : (event.target.value as WallType)
              })
            }
            className="mt-2 w-full rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-3 py-2 text-sm font-medium text-slate-700 outline-none disabled:cursor-not-allowed disabled:opacity-70"
          >
            <option value="">None</option>
            {WALL_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <label className="mt-4 flex items-center justify-between rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-3 py-2">
            <span className="text-xs font-semibold text-slate-700">
              Block rack placement
            </span>
            <input
              type="checkbox"
              checked={wall.blocksRackPlacement}
              disabled={!isLayoutEditable}
              onChange={(event) =>
                updateWallDetails(wall.id, {
                  blocksRackPlacement: event.target.checked
                })
              }
              className="h-4 w-4"
            />
          </label>
        </div>

        <div className="rounded-xl border border-[var(--border-muted)] p-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Geometry
            </div>
            <div className="font-mono text-[11px] font-semibold text-slate-500">
              {Math.round(wallLength)} px
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {([
              { key: 'x1' as const, label: 'X1', value: wall.x1 },
              { key: 'y1' as const, label: 'Y1', value: wall.y1 },
              { key: 'x2' as const, label: 'X2', value: wall.x2 },
              { key: 'y2' as const, label: 'Y2', value: wall.y2 }
            ]).map((field) => (
              <label key={field.key} className="block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {field.label}
                </span>
                <input
                  type="number"
                  min={0}
                  value={Math.round(field.value)}
                  disabled={!isLayoutEditable}
                  onChange={(event) => {
                    const nextValue = parseCoordinateInput(
                      event.target.value,
                      field.value
                    );
                    updateWallGeometry(wall.id, {
                      x1: field.key === 'x1' ? nextValue : wall.x1,
                      y1: field.key === 'y1' ? nextValue : wall.y1,
                      x2: field.key === 'x2' ? nextValue : wall.x2,
                      y2: field.key === 'y2' ? nextValue : wall.y2
                    });
                  }}
                  className="mt-1 w-full rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-3 py-2 font-mono text-xs text-slate-700 outline-none disabled:cursor-not-allowed disabled:opacity-70"
                />
              </label>
            ))}
          </div>
        </div>

        {isLayoutEditable && (
          !confirmingDelete ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" />
              Delete wall
            </button>
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <div className="text-sm font-semibold text-red-700">Delete this wall?</div>
              <p className="mt-1 text-xs text-red-600">
                This removes the segment from the draft. Any source rack side remains independent.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-lg border border-[var(--border-muted)] bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteWall(wall.id);
                    setConfirmingDelete(false);
                  }}
                  className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </aside>
  );
}
