import { resolveRackFaceRelationshipMode, type RackFace } from '@wos/domain';
import { useUpdateRackLevelStructuralDefaultRole } from '@/widgets/warehouse-editor/model/editor-selectors';

type StructuralRole = 'primary_pick' | 'reserve' | 'none';
type RackLevelRowState =
  | { kind: 'uniform'; role: StructuralRole }
  | { kind: 'mixed'; roles: StructuralRole[] };

function RoleButton({
  label,
  active,
  disabled,
  onClick
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex-1 px-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
        active
          ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5'
          : 'text-slate-400 hover:text-slate-600 disabled:hover:text-slate-400'
      }`}
    >
      {label}
    </button>
  );
}

function resolveLevelRoleState(faces: RackFace[], ordinal: number): RackLevelRowState {
  const roles = faces.map((face) => {
    const sampleLevel = face.sections.flatMap((section) => section.levels).find((level) => level.ordinal === ordinal);
    return sampleLevel?.structuralDefaultRole ?? 'none';
  });

  const unique = Array.from(new Set(roles));
  if (unique.length === 1) {
    return { kind: 'uniform', role: unique[0] as StructuralRole };
  }
  return { kind: 'mixed', roles: unique as StructuralRole[] };
}

export function RackLevelDefaultsPanel({
  rackId,
  faceA,
  faceB,
  readOnly = false
}: {
  rackId: string;
  faceA: RackFace | null;
  faceB: RackFace | null;
  readOnly?: boolean;
}) {
  const updateRackLevelRole = useUpdateRackLevelStructuralDefaultRole();
  const isMirrored = !!faceB && resolveRackFaceRelationshipMode(faceB) === 'mirrored';
  const editableFaces = [faceA, faceB].filter((face): face is RackFace => {
    if (!face) return false;
    if (face.side === 'A') return true;
    return face.enabled && !isMirrored && face.sections.length > 0;
  });

  const ordinals = Array.from(
    new Set(editableFaces.flatMap((face) => face.sections.flatMap((section) => section.levels.map((level) => level.ordinal))))
  ).sort((a, b) => b - a);

  if (ordinals.length === 0) return null;

  return (
    <div
      data-testid="rack-level-defaults-panel"
      className="flex flex-col gap-3 rounded-[14px] border border-[var(--border-muted)] bg-[var(--surface-secondary)] p-4"
    >
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Apply role to all faces at this level
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Applies the selected role to all editable faces at this level.
        </p>
        <p className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
          Reapplying here replaces differing face-level defaults at this level.
        </p>
        {isMirrored && (
          <p className="mt-1 text-xs text-blue-700">
            Face B is mirrored, so editable defaults are applied through Face A.
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-[18px] border border-[var(--border-muted)] bg-white shadow-sm">
        <div className="grid grid-cols-[52px_1fr_88px] items-center gap-2 border-b border-[var(--border-muted)] bg-[var(--surface-secondary)] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          <span>#</span>
          <span>Structural Default Role</span>
          <span className="text-right">Default-role state</span>
        </div>

        <div className="divide-y divide-[var(--border-muted)]">
          {ordinals.map((ordinal) => {
            const state = resolveLevelRoleState(editableFaces, ordinal);
            const currentRole = state.kind === 'uniform' ? state.role : null;

            return (
              <div key={ordinal} className="grid grid-cols-[52px_1fr_88px] items-center gap-2 px-4 py-2.5 text-sm text-slate-700">
                <span className="font-mono text-slate-500">{String(ordinal).padStart(2, '0')}</span>

                <div className="flex p-0.5 rounded-xl border border-[var(--border-muted)] bg-slate-50 shadow-sm">
                  <RoleButton
                    label="Pick"
                    active={currentRole === 'primary_pick'}
                    disabled={readOnly}
                    onClick={() => updateRackLevelRole(rackId, ordinal, 'primary_pick')}
                  />
                  <RoleButton
                    label="Res"
                    active={currentRole === 'reserve'}
                    disabled={readOnly}
                    onClick={() => updateRackLevelRole(rackId, ordinal, 'reserve')}
                  />
                  <RoleButton
                    label="None"
                    active={currentRole === 'none'}
                    disabled={readOnly}
                    onClick={() => updateRackLevelRole(rackId, ordinal, 'none')}
                  />
                </div>

                <div className="text-right text-xs">
                  {state.kind === 'mixed' ? (
                    <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-700">Mixed</span>
                  ) : (
                    <span className="text-slate-400">Aligned</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
