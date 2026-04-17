import type { RackFace } from '@wos/domain';

export function AddressAnatomy({ faceA, faceB }: { faceA: RackFace | null; faceB: RackFace | null }) {
  const faces = [faceA, faceB].filter((f): f is RackFace => !!f);
  if (!faces.length) return null;

  const exampleFace = faces[0];
  const exampleSlot = exampleFace.sections[0]?.levels[0]?.slotCount ?? 1;
  const exampleLevel = exampleFace.sections[0]?.levels.length ?? 1;
  const exampleAddress = `${exampleFace.side}-01-001`;

  return (
    <div className="rounded-[14px] border border-[var(--border-muted)] bg-white p-4 shadow-sm">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Address Format
      </div>

      <svg viewBox="0 0 300 120" className="w-full bg-slate-50 rounded-lg" style={{ maxHeight: '110px' }}>
        {/* Address example breakdown */}
        <g>
          {/* Full address */}
          <text x="10" y="25" className="text-[12px] font-mono font-semibold fill-slate-900">
            {exampleAddress}
          </text>

          {/* Face part */}
          <rect x="10" y="35" width="20" height="20" fill="#e0e7ff" stroke="#6366f1" strokeWidth="1.5" rx="2" />
          <text x="20" y="52" textAnchor="middle" className="text-[10px] font-mono font-semibold fill-indigo-600">
            {exampleFace.side}
          </text>
          <text x="20" y="70" textAnchor="middle" className="text-[9px] fill-slate-600">
            Face
          </text>

          {/* Slot part */}
          <rect x="45" y="35" width="30" height="20" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5" rx="2" />
          <text x="60" y="52" textAnchor="middle" className="text-[10px] font-mono font-semibold fill-amber-700">
            01
          </text>
          <text x="60" y="70" textAnchor="middle" className="text-[9px] fill-slate-600">
            Slot
          </text>

          {/* Level part */}
          <rect x="90" y="35" width="30" height="20" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5" rx="2" />
          <text x="105" y="52" textAnchor="middle" className="text-[10px] font-mono font-semibold fill-blue-700">
            001
          </text>
          <text x="105" y="70" textAnchor="middle" className="text-[9px] fill-slate-600">
            Level
          </text>
        </g>

        {/* Legend */}
        <g>
          <line x1="135" y1="15" x2="135" y2="95" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="2,2" />

          {/* Face count */}
          <circle cx="155" cy="25" r="4" fill="#6366f1" />
          <text x="165" y="29" className="text-[10px] fill-slate-700">
            <tspan fontWeight="600">Faces:</tspan> {faces.length}
          </text>

          {/* Slot count */}
          <circle cx="155" cy="45" r="4" fill="#f59e0b" />
          <text x="165" y="49" className="text-[10px] fill-slate-700">
            <tspan fontWeight="600">Max slots:</tspan> {exampleSlot}
          </text>

          {/* Level count */}
          <circle cx="155" cy="65" r="4" fill="#3b82f6" />
          <text x="165" y="69" className="text-[10px] fill-slate-700">
            <tspan fontWeight="600">Levels:</tspan> {exampleLevel}
          </text>

          {/* Note about numbering */}
          <text x="155" y="90" className="text-[8px] fill-slate-500 italic">
            Slots: {exampleFace.slotNumberingDirection === 'ltr' ? '01 → 0N' : '0N → 01'}
          </text>
        </g>
      </svg>
    </div>
  );
}
