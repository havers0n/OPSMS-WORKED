import { resolveRackFaceRelationshipMode } from '@wos/domain';
import type { Rack, RackFace } from '@wos/domain';
import {
  useResetFaceB,
  useSetFaceBRelationship
} from '@/warehouse/editor/model/editor-selectors';
import { FaceBEmptyState } from '@/features/face-b-configure-mode/ui/face-b-empty-state';

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export function FaceModeTask({
  rack,
  faceB,
  readOnly
}: {
  rack: Rack;
  faceB: RackFace | null;
  readOnly: boolean;
}) {
  const setFaceBRelationship = useSetFaceBRelationship();
  const resetFaceB = useResetFaceB();

  const faceBRelationshipMode = faceB ? resolveRackFaceRelationshipMode(faceB) : 'independent';
  const isMirrored = !!faceB && faceBRelationshipMode === 'mirrored';
  const faceBConfigured = !!faceB && (isMirrored || faceB.sections.length > 0);

  const handleInit = (mode: 'mirror' | 'copy' | 'scratch') => {
    if (mode === 'mirror') {
      setFaceBRelationship(rack.id, 'mirrored');
    } else {
      setFaceBRelationship(rack.id, 'independent', { initFrom: mode });
    }
  };

  if (!faceBConfigured) {
    return (
      <div className="px-5 py-5">
        <FaceBEmptyState
          selectedMode={null}
          onSelectMode={readOnly ? () => {} : handleInit}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-5 py-5">
      <div className="rounded-[14px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-4">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Face B Relationship
        </div>
        <div className="flex gap-1 rounded-xl border border-[var(--border-muted)] bg-white p-1">
          {(
            [
              { value: 'mirrored', label: 'Mirrored' },
              { value: 'independent', label: 'Independent' }
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={readOnly}
              onClick={() => {
                if (opt.value === 'mirrored') {
                  setFaceBRelationship(rack.id, 'mirrored');
                } else if (isMirrored) {
                  setFaceBRelationship(rack.id, 'independent', { initFrom: 'copy' });
                }
              }}
              className={cn(
                'flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:text-slate-400',
                (opt.value === 'mirrored' ? isMirrored : !isMirrored)
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {isMirrored
            ? 'Face B mirrors Face A structurally. Numbering reverses automatically.'
            : 'Face B has its own independent sections, numbering, and structure.'}
        </p>
      </div>

      <div className="rounded-[14px] border border-[var(--border-muted)] bg-white p-4 shadow-sm">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Remove Face B
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Converts the rack back to a single-face rack. Independent Face B sections are discarded.
        </p>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => resetFaceB(rack.id)}
          className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:border-[var(--border-muted)] disabled:text-slate-400 disabled:hover:bg-white"
        >
          Remove Face B
        </button>
      </div>
    </div>
  );
}
