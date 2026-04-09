import type { FloorWorkspace, ZoneCategory, ZonePlacementBehavior } from '@wos/domain';
import { getZonePlacementBehavior } from '@wos/domain';
import { SlidersHorizontal, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  useDeleteZone,
  useIsLayoutEditable,
  useSelectedZoneId,
  useUpdateZoneDetails,
  useUpdateZoneRect
} from '@/widgets/warehouse-editor/model/editor-selectors';
import { useWorkspaceLayout } from '../lib/use-workspace-layout';

const ZONE_CATEGORY_OPTIONS: Array<{ value: ZoneCategory; label: string }> = [
  { value: 'generic', label: 'Generic' },
  { value: 'storage', label: 'Storage' },
  { value: 'staging', label: 'Staging' },
  { value: 'packing', label: 'Packing' },
  { value: 'receiving', label: 'Receiving' },
  { value: 'custom', label: 'Custom' }
];

const PLACEMENT_BEHAVIOR_DISPLAY: Record<
  ZonePlacementBehavior,
  { label: string; description: string }
> = {
  none: {
    label: 'Context only',
    description:
      'This zone marks an operational area. No containers are placed here directly — it holds no rack cells or floor locations.'
  },
  children_only: {
    label: 'Via rack cells',
    description:
      'Containers are placed inside rack cells within this zone. The zone boundary itself is not a placement target.'
  },
  direct: {
    label: 'Direct placement',
    description:
      'This zone type is designed for direct container placement (staging, dock). Floor-level location support is planned.'
  }
};

function parseGeometryInput(value: string, fallback: number, min: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.round(parsed));
}

export function ZoneInspector({
  workspace,
  onClose
}: {
  workspace: FloorWorkspace | null;
  onClose: () => void;
}) {
  const layoutDraft = useWorkspaceLayout(workspace);
  const selectedZoneId = useSelectedZoneId();
  const updateZoneDetails = useUpdateZoneDetails();
  const updateZoneRect = useUpdateZoneRect();
  const deleteZone = useDeleteZone();
  const isLayoutEditable = useIsLayoutEditable();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const zone =
    layoutDraft && selectedZoneId ? layoutDraft.zones[selectedZoneId] ?? null : null;

  useEffect(() => {
    setConfirmingDelete(false);
  }, [selectedZoneId]);

  if (!zone) {
    return (
      <aside className="flex h-full w-full flex-col bg-white">
        <div className="flex items-center justify-between border-b border-[var(--border-muted)] px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            Zone
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
          Select a zone to inspect its properties.
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden bg-white">
      <div className="flex items-center justify-between border-b border-[var(--border-muted)] px-5 py-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              Zone
            </div>
            <div className="mt-0.5 text-sm font-semibold text-slate-800">
              {zone.code}
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
            Name
          </label>
          <input
            type="text"
            value={zone.name}
            disabled={!isLayoutEditable}
            onChange={(event) => {
              const nextName = event.target.value.trimStart();
              updateZoneDetails(zone.id, {
                name: nextName.trim().length > 0 ? nextName : zone.name
              });
            }}
            className="mt-2 w-full rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-3 py-2 text-sm font-medium text-slate-700 outline-none disabled:cursor-not-allowed disabled:opacity-70"
          />

          <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Category
          </label>
          <select
            value={zone.category ?? ''}
            disabled={!isLayoutEditable}
            onChange={(event) =>
              updateZoneDetails(zone.id, {
                category:
                  event.target.value === ''
                    ? null
                    : (event.target.value as ZoneCategory)
              })
            }
            className="mt-2 w-full rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-3 py-2 text-sm font-medium text-slate-700 outline-none disabled:cursor-not-allowed disabled:opacity-70"
          >
            <option value="">None</option>
            {ZONE_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Color
          </label>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="color"
              value={zone.color}
              disabled={!isLayoutEditable}
              onChange={(event) => updateZoneDetails(zone.id, { color: event.target.value })}
              className="h-10 w-14 cursor-pointer rounded-lg border border-[var(--border-muted)] bg-white p-1 disabled:cursor-not-allowed disabled:opacity-70"
            />
            <input
              type="text"
              value={zone.color}
              readOnly
              disabled={!isLayoutEditable}
              className="w-full rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-3 py-2 font-mono text-xs text-slate-700 outline-none disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>

          {(() => {
            const behavior = getZonePlacementBehavior(zone.category);
            const display = PLACEMENT_BEHAVIOR_DISPLAY[behavior];
            return (
              <div className="mt-4">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Placement behavior
                </label>
                <div className="mt-2 rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-3 py-2">
                  <div className="text-xs font-semibold text-slate-700">{display.label}</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    {display.description}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="rounded-xl border border-[var(--border-muted)] p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Geometry
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { key: 'x' as const, label: 'X', value: zone.x, min: 0 },
              { key: 'y' as const, label: 'Y', value: zone.y, min: 0 },
              { key: 'width' as const, label: 'Width', value: zone.width, min: 40 },
              { key: 'height' as const, label: 'Height', value: zone.height, min: 40 }
            ].map((field) => (
              <label key={field.key} className="block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {field.label}
                </span>
                <input
                  type="number"
                  min={field.min}
                  value={Math.round(field.value)}
                  disabled={!isLayoutEditable}
                  onChange={(event) => {
                    const nextValue = parseGeometryInput(
                      event.target.value,
                      field.value,
                      field.min
                    );
                    updateZoneRect(zone.id, {
                      x: field.key === 'x' ? nextValue : zone.x,
                      y: field.key === 'y' ? nextValue : zone.y,
                      width: field.key === 'width' ? nextValue : zone.width,
                      height: field.key === 'height' ? nextValue : zone.height
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
              Delete zone
            </button>
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <div className="text-sm font-semibold text-red-700">Delete this zone?</div>
              <p className="mt-1 text-xs text-red-600">
                This removes the zone rectangle and its label from the draft.
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
                    deleteZone(zone.id);
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
