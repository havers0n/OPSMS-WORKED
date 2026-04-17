import type { RackFace } from '@wos/domain';
import { useUpdateLevelStructuralDefaultRole } from '@/widgets/warehouse-editor/model/editor-selectors';

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
          ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/5" 
          : "text-slate-400 hover:text-slate-600 disabled:hover:text-slate-400"
      }`}
    >
      {label}
    </button>
  );
}

export function LevelDefaultsPanel({
  rackId,
  face,
  readOnly = false,
  heading = 'Face-level defaults',
  description = 'Applies only to this face at this level.'
}: {
  rackId: string;
  face: RackFace;
  readOnly?: boolean;
  heading?: string;
  description?: string;
}) {
  const updateLevelRole = useUpdateLevelStructuralDefaultRole();

  // Find all unique ordinals in the face
  const ordinals = Array.from(
    new Set(face.sections.flatMap((s) => s.levels.map((l) => l.ordinal)))
  ).sort((a, b) => b - a); // Highest ordinal at top (physical order)

  if (ordinals.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          {heading}
        </h3>
      </div>
      <p className="text-xs text-slate-500">{description}</p>
      
      <div className="overflow-hidden rounded-[18px] border border-[var(--border-muted)] bg-white shadow-sm">
        <div className="grid grid-cols-[52px_1fr] items-center gap-2 border-b border-[var(--border-muted)] bg-[var(--surface-secondary)] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          <span>#</span>
          <span>Structural Default Role</span>
        </div>
        
        <div className="divide-y divide-[var(--border-muted)]">
          {ordinals.map((ordinal) => {
            // Role display logic: 
            // - If multiple sections have this level with the same role, show it.
            // - If roles differ (shouldn't happen with our UI, but domain allows), 
            //   show the role from the first section as source of truth.
            const sampleLevel = face.sections
              .flatMap((s) => s.levels)
              .find((l) => l.ordinal === ordinal);
            const currentRole = sampleLevel?.structuralDefaultRole ?? 'none';

            return (
              <div key={ordinal} className="grid grid-cols-[52px_1fr] items-center gap-2 px-4 py-2.5 text-sm text-slate-700">
                <span className="font-mono text-slate-500">
                  {String(ordinal).padStart(2, '0')}
                </span>
                
                <div className="flex p-0.5 rounded-xl border border-[var(--border-muted)] bg-slate-50 shadow-sm">
                  <RoleButton 
                    label="Pick" 
                    active={currentRole === 'primary_pick'} 
                    disabled={readOnly} 
                    onClick={() => updateLevelRole(rackId, face.side, ordinal, 'primary_pick')}
                  />
                  <RoleButton 
                    label="Res" 
                    active={currentRole === 'reserve'} 
                    disabled={readOnly} 
                    onClick={() => updateLevelRole(rackId, face.side, ordinal, 'reserve')}
                  />
                  <RoleButton 
                    label="None" 
                    active={currentRole === 'none'} 
                    disabled={readOnly} 
                    onClick={() => updateLevelRole(rackId, face.side, ordinal, 'none')}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
