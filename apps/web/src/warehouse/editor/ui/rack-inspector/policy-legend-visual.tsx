export function PolicyLegendVisual() {
  const policies = [
    { color: 'bg-blue-500', label: 'Pick', description: 'Primary picking location' },
    { color: 'bg-amber-500', label: 'Reserve', description: 'Overflow/reserve storage' },
    { color: 'bg-slate-300', label: 'None', description: 'Not assigned' }
  ];

  return (
    <div className="rounded-[14px] border border-[var(--border-muted)] bg-white p-4 shadow-sm">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Storage Policies
      </div>

      <svg viewBox="0 0 280 120" className="w-full bg-slate-50 rounded-lg" style={{ maxHeight: '110px' }}>
        {/* Warehouse rack diagram with colored cells */}
        <g>
          {/* Rack outline */}
          <rect x="20" y="15" width="80" height="60" fill="none" stroke="#64748b" strokeWidth="1.5" rx="2" />

          {/* Level labels */}
          {[0, 1, 2].map((level) => (
            <text key={`level-${level}`} x="15" y={35 + level * 20} className="text-[9px] fill-slate-500">
              L{level + 1}
            </text>
          ))}

          {/* Cells with colors */}
          {[0, 1, 2].map((slot) => (
            <rect
              key={`policy-${slot}`}
              x={23 + slot * 20}
              y="18"
              width="18"
              height="18"
              fill={policies[slot].color}
              opacity="0.8"
              rx="1"
            />
          ))}

          {/* Horizontal dividers */}
          {[1, 2].map((level) => (
            <line
              key={`div-${level}`}
              x1="20"
              y1={15 + level * 20}
              x2="100"
              y2={15 + level * 20}
              stroke="#cbd5e1"
              strokeWidth="0.5"
            />
          ))}
        </g>

        {/* Legend items */}
        <g>
          {policies.map((policy, idx) => (
            <g key={policy.label}>
              <rect
                x="130"
                y={20 + idx * 28}
                width="12"
                height="12"
                className={policy.color}
                rx="2"
              />
              <text
                x="148"
                y={27 + idx * 28}
                className="text-[10px] font-semibold fill-slate-700"
              >
                {policy.label}
              </text>
              <text
                x="148"
                y={38 + idx * 28}
                className="text-[8px] fill-slate-500"
              >
                {policy.description}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
