import type { RackFace } from '@wos/domain';

const FACE_COLORS: Record<'A' | 'B', { cell: string; border: string; header: string; text: string }> = {
  A: { cell: '#bae6fd', border: '#0ea5e9', header: '#0369a1', text: '#0c4a6e' },
  B: { cell: '#ddd6fe', border: '#8b5cf6', header: '#6d28d9', text: '#3b0764' }
};

/**
 * SVG schematic of the front elevation of a rack face.
 * Columns = sections, rows = levels, each cell = one slot.
 * The view is intentionally schematic — not pixel-perfect — just enough
 * to give the user a spatial sense of what they're configuring.
 */
export function FrontElevationPreview({ face, side }: { face: Pick<RackFace, 'sections'>; side: 'A' | 'B' }) {
  const colors = FACE_COLORS[side];
  const sections = face.sections;

  if (sections.length === 0) {
    return (
      <div className="flex h-16 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
        No sections
      </div>
    );
  }

  const maxLevels = Math.max(...sections.map((s) => s.levels.length), 1);
  const totalSlots = sections.reduce((sum, s) => sum + (s.levels[0]?.slotCount ?? 1), 0);

  // Layout constants
  const svgHeight = 80;
  const headerH = 14;
  const bodyH = svgHeight - headerH;
  const cellH = bodyH / maxLevels;

  // Build section column widths proportional to their slot count
  const sectionWidthRatios = sections.map((s) => (s.levels[0]?.slotCount ?? 1) / Math.max(totalSlots, 1));

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <svg
        viewBox={`0 0 100 ${svgHeight}`}
        preserveAspectRatio="none"
        width="100%"
        height={svgHeight}
        aria-label={`Front elevation preview — Face ${side}`}
      >
        {/* Render each section as a column */}
        {(() => {
          let xCursor = 0;
          return sections.map((section, si) => {
            const colW = sectionWidthRatios[si] * 100;
            const levelCount = section.levels.length;
            const slotCount = section.levels[0]?.slotCount ?? 1;

            const col = (
              <g key={section.id}>
                {/* Section header band */}
                <rect
                  x={xCursor}
                  y={0}
                  width={colW}
                  height={headerH}
                  fill={colors.header}
                  opacity={0.9}
                />
                <text
                  x={xCursor + colW / 2}
                  y={headerH - 3}
                  textAnchor="middle"
                  fontSize={7}
                  fill="white"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  S{String(section.ordinal).padStart(2, '0')}
                </text>

                {/* Level rows — rendered bottom-to-top (L1 at bottom) */}
                {Array.from({ length: levelCount }, (_, li) => {
                  const rowIndex = levelCount - 1 - li; // flip so L1 is bottom
                  const y = headerH + rowIndex * cellH;
                  const slotW = colW / slotCount;

                  return (
                    <g key={li}>
                      {Array.from({ length: slotCount }, (__, si2) => (
                        <rect
                          key={si2}
                          x={xCursor + si2 * slotW + 0.3}
                          y={y + 0.3}
                          width={slotW - 0.6}
                          height={cellH - 0.6}
                          fill={colors.cell}
                          stroke={colors.border}
                          strokeWidth={0.4}
                          rx={0.5}
                        />
                      ))}
                    </g>
                  );
                })}

                {/* Section right border */}
                {si < sections.length - 1 && (
                  <line
                    x1={xCursor + colW}
                    y1={headerH}
                    x2={xCursor + colW}
                    y2={svgHeight}
                    stroke={colors.border}
                    strokeWidth={0.8}
                    strokeDasharray="2,1"
                  />
                )}
              </g>
            );

            xCursor += colW;
            return col;
          });
        })()}

        {/* Outer border */}
        <rect x={0} y={0} width={100} height={svgHeight} fill="none" stroke={colors.border} strokeWidth={0.8} />
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-white px-2.5 py-1">
        <span className="text-[10px] font-semibold text-slate-500">
          Face {side}
        </span>
        <span className="text-[10px] text-slate-400">
          {sections.length} sec · {Math.max(...sections.map((s) => s.levels.length), 0)} lvl ·{' '}
          {sections[0]?.levels[0]?.slotCount ?? 0} slots/lvl
        </span>
      </div>
    </div>
  );
}
