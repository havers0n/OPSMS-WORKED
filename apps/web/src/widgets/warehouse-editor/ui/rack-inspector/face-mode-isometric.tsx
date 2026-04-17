import type { Rack, RackFace } from '@wos/domain';
import { resolveRackFaceRelationshipMode } from '@wos/domain';

export function FaceModeIsometric({
  rack,
  faceB
}: {
  rack: Rack;
  faceB: RackFace | null;
}) {
  const faceBRelationshipMode = faceB ? resolveRackFaceRelationshipMode(faceB) : null;
  const isMirrored = !!faceB && faceBRelationshipMode === 'mirrored';
  const faceBConfigured = !!faceB && (isMirrored || faceB.sections.length > 0);

  const STATE = !faceBConfigured ? 'single' : isMirrored ? 'mirrored' : 'independent';

  return (
    <div className="rounded-[14px] border border-[var(--border-muted)] bg-white p-4 shadow-sm">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Face Configuration
      </div>

      <svg viewBox="0 0 280 160" className="w-full bg-slate-50 rounded-lg" style={{ maxHeight: '150px' }}>
        {/* Single Face */}
        <g>
          <text x="35" y="20" className="text-[11px] font-semibold fill-slate-700" textAnchor="middle">
            Single
          </text>
          <rect
            x="10"
            y="30"
            width="50"
            height="90"
            fill={STATE === 'single' ? '#e0e7ff' : '#f1f5f9'}
            stroke={STATE === 'single' ? '#6366f1' : '#cbd5e1'}
            strokeWidth={STATE === 'single' ? 2 : 1}
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
        <g>
          <text x="140" y="20" className="text-[11px] font-semibold fill-slate-700" textAnchor="middle">
            Mirrored
          </text>
          <rect
            x="115"
            y="30"
            width="25"
            height="90"
            fill={STATE === 'mirrored' ? '#dbeafe' : '#f1f5f9'}
            stroke={STATE === 'mirrored' ? '#3b82f6' : '#cbd5e1'}
            strokeWidth={STATE === 'mirrored' ? 2 : 1}
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
            fill={STATE === 'mirrored' ? '#dbeafe' : '#f1f5f9'}
            stroke={STATE === 'mirrored' ? '#3b82f6' : '#cbd5e1'}
            strokeWidth={STATE === 'mirrored' ? 2 : 1}
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
        <g>
          <text x="245" y="20" className="text-[11px] font-semibold fill-slate-700" textAnchor="middle">
            Independent
          </text>
          <rect
            x="220"
            y="30"
            width="25"
            height="90"
            fill={STATE === 'independent' ? '#fef3c7' : '#f1f5f9'}
            stroke={STATE === 'independent' ? '#f59e0b' : '#cbd5e1'}
            strokeWidth={STATE === 'independent' ? 2 : 1}
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
            fill={STATE === 'independent' ? '#fef3c7' : '#f1f5f9'}
            stroke={STATE === 'independent' ? '#f59e0b' : '#cbd5e1'}
            strokeWidth={STATE === 'independent' ? 2 : 1}
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
