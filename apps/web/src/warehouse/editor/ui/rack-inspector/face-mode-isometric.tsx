import type { Rack, RackFace } from '@wos/domain';
import { resolveRackFaceRelationshipMode } from '@wos/domain';

export type TopologyChoice = 'single' | 'mirrored' | 'independent';

export function FaceModeIsometric({
  rack: _rack,
  faceB,
  readOnly,
  onSelectTopology
}: {
  rack: Rack;
  faceB: RackFace | null;
  readOnly: boolean;
  onSelectTopology: (topology: TopologyChoice) => void;
}) {
  const faceBRelationshipMode = faceB ? resolveRackFaceRelationshipMode(faceB) : null;
  const isMirrored = !!faceB && faceBRelationshipMode === 'mirrored';
  const faceBConfigured = !!faceB && (isMirrored || faceB.sections.length > 0);

  const currentTopology: TopologyChoice = !faceBConfigured
    ? 'single'
    : isMirrored
      ? 'mirrored'
      : 'independent';

  const handleSelect = (topology: TopologyChoice) => {
    if (readOnly) return;
    onSelectTopology(topology);
  };

  return (
    <div
      data-testid="structure-topology-face-configuration"
      className="rounded-[14px] border border-[var(--border-muted)] bg-white p-4 shadow-sm"
    >
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Face Configuration
      </div>

      <svg viewBox="0 0 280 160" className="w-full bg-slate-50 rounded-lg" style={{ maxHeight: '150px' }}>
        {/* Single Face */}
        <g
          data-testid="structure-topology-option-single"
          onClick={() => handleSelect('single')}
          className={readOnly ? undefined : 'cursor-pointer'}
        >
          <text x="35" y="20" className="text-[11px] font-semibold fill-slate-700" textAnchor="middle">
            Single
          </text>
          <rect
            x="10"
            y="30"
            width="50"
            height="90"
            fill={currentTopology === 'single' ? '#e0e7ff' : '#f1f5f9'}
            stroke={currentTopology === 'single' ? '#6366f1' : '#cbd5e1'}
            strokeWidth={currentTopology === 'single' ? 2 : 1}
            rx="2"
          />
          <text x="35" y="77" className="text-[10px] font-semibold fill-slate-600" textAnchor="middle">
            A
          </text>
          <text x="35" y="135" className="text-[9px] fill-slate-500" textAnchor="middle">
            Only Face A
          </text>
        </g>

        {/* Mirrored */}
        <g
          data-testid="structure-topology-option-mirrored"
          onClick={() => handleSelect('mirrored')}
          className={readOnly ? undefined : 'cursor-pointer'}
        >
          <text x="140" y="20" className="text-[11px] font-semibold fill-slate-700" textAnchor="middle">
            Mirrored
          </text>
          <rect
            x="115"
            y="30"
            width="25"
            height="90"
            fill={currentTopology === 'mirrored' ? '#dbeafe' : '#f1f5f9'}
            stroke={currentTopology === 'mirrored' ? '#3b82f6' : '#cbd5e1'}
            strokeWidth={currentTopology === 'mirrored' ? 2 : 1}
            rx="2"
          />
          <text x="127" y="77" className="text-[9px] font-semibold fill-slate-600" textAnchor="middle">
            A
          </text>
          <rect
            x="140"
            y="30"
            width="25"
            height="90"
            fill={currentTopology === 'mirrored' ? '#dbeafe' : '#f1f5f9'}
            stroke={currentTopology === 'mirrored' ? '#3b82f6' : '#cbd5e1'}
            strokeWidth={currentTopology === 'mirrored' ? 2 : 1}
            rx="2"
            opacity="0.6"
          />
          <text x="152" y="77" className="text-[9px] font-semibold fill-slate-600" textAnchor="middle" opacity="0.6">
            B
          </text>
          <path d="M 138 50 L 142 50 M 138 100 L 142 100" stroke="#94a3b8" strokeWidth="1" strokeDasharray="1,2" />
          <text x="140" y="135" className="text-[9px] fill-slate-500" textAnchor="middle">
            Face B mirrors A
          </text>
        </g>

        {/* Independent */}
        <g
          data-testid="structure-topology-option-independent"
          onClick={() => handleSelect('independent')}
          className={readOnly ? undefined : 'cursor-pointer'}
        >
          <text x="245" y="20" className="text-[11px] font-semibold fill-slate-700" textAnchor="middle">
            Independent
          </text>
          <rect
            x="220"
            y="30"
            width="25"
            height="90"
            fill={currentTopology === 'independent' ? '#fef3c7' : '#f1f5f9'}
            stroke={currentTopology === 'independent' ? '#f59e0b' : '#cbd5e1'}
            strokeWidth={currentTopology === 'independent' ? 2 : 1}
            rx="2"
          />
          <text x="232" y="77" className="text-[9px] font-semibold fill-slate-600" textAnchor="middle">
            A
          </text>
          <rect
            x="245"
            y="30"
            width="25"
            height="90"
            fill={currentTopology === 'independent' ? '#fef3c7' : '#f1f5f9'}
            stroke={currentTopology === 'independent' ? '#f59e0b' : '#cbd5e1'}
            strokeWidth={currentTopology === 'independent' ? 2 : 1}
            rx="2"
          />
          <text x="257" y="77" className="text-[9px] font-semibold fill-slate-600" textAnchor="middle">
            B
          </text>
          <text x="245" y="135" className="text-[9px] fill-slate-500" textAnchor="middle">
            Independent config
          </text>
        </g>

        {/* Current state indicator */}
        <circle cx="280" cy="20" r="3" fill="#10b981" />
        <text x="270" y="24" className="text-[9px] fill-slate-600" textAnchor="end">
          Current
        </text>
      </svg>
    </div>
  );
}
