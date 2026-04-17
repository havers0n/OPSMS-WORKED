import type { RackFace } from '@wos/domain';

export function SlotDirectionVisual({ face }: { face: RackFace }) {
  const isLTR = face.slotNumberingDirection === 'ltr';

  return (
    <div className="rounded-[14px] border border-[var(--border-muted)] bg-white p-4 shadow-sm">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Slot Numbering Direction
      </div>

      <svg viewBox="0 0 280 100" className="w-full bg-slate-50 rounded-lg" style={{ maxHeight: '90px' }}>
        {/* LTR */}
        <g>
          <text x="45" y="20" className="text-[11px] font-semibold fill-slate-700" textAnchor="middle">
            Left → Right
          </text>
          <g opacity={isLTR ? 1 : 0.4}>
            {[0, 1, 2].map((i) => (
              <rect
                key={`ltr-${i}`}
                x={20 + i * 18}
                y="30"
                width="15"
                height="35"
                fill={isLTR ? '#e0e7ff' : '#f1f5f9'}
                stroke={isLTR ? '#6366f1' : '#cbd5e1'}
                strokeWidth={isLTR ? 1.5 : 1}
                rx="2"
              />
            ))}
            {[0, 1, 2].map((i) => (
              <text
                key={`ltr-text-${i}`}
                x={27 + i * 18}
                y="54"
                className="text-[10px] font-semibold fill-slate-700"
                textAnchor="middle"
              >
                {String(i + 1).padStart(2, '0')}
              </text>
            ))}
            <path d="M 65 50 L 75 50" stroke="#3b82f6" strokeWidth="2" />
            <polygon points="75,50 70,47 70,53" fill="#3b82f6" />
          </g>
          <text x="45" y="80" className="text-[9px] fill-slate-500" textAnchor="middle">
            01, 02, 03...
          </text>
        </g>

        {/* RTL */}
        <g>
          <text x="215" y="20" className="text-[11px] font-semibold fill-slate-700" textAnchor="middle">
            Right ← Left
          </text>
          <g opacity={!isLTR ? 1 : 0.4}>
            {[0, 1, 2].map((i) => (
              <rect
                key={`rtl-${i}`}
                x={190 + i * 18}
                y="30"
                width="15"
                height="35"
                fill={!isLTR ? '#fef3c7' : '#f1f5f9'}
                stroke={!isLTR ? '#f59e0b' : '#cbd5e1'}
                strokeWidth={!isLTR ? 1.5 : 1}
                rx="2"
              />
            ))}
            {[0, 1, 2].map((i) => (
              <text
                key={`rtl-text-${i}`}
                x={197 + i * 18}
                y="54"
                className="text-[10px] font-semibold fill-slate-700"
                textAnchor="middle"
              >
                {String(3 - i).padStart(2, '0')}
              </text>
            ))}
            <path d="M 185 50 L 175 50" stroke="#f59e0b" strokeWidth="2" />
            <polygon points="175,50 180,47 180,53" fill="#f59e0b" />
          </g>
          <text x="215" y="80" className="text-[9px] fill-slate-500" textAnchor="middle">
            03, 02, 01...
          </text>
        </g>
      </svg>
    </div>
  );
}
