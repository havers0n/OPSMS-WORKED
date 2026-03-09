import type { RackFace } from '@wos/domain';

const FACE_COLORS: Record<'A' | 'B', { cell: string; border: string; header: string; text: string }> = {
  A: { cell: '#bae6fd', border: '#0ea5e9', header: '#0369a1', text: '#0c4a6e' },
  B: { cell: '#ddd6fe', border: '#8b5cf6', header: '#6d28d9', text: '#3b0764' }
};

/**
 * SVG schematic of the front elevation of a rack face.
 * Columns = sections (in address order), rows = levels (L1 at bottom), cells = slots.
 *
 * Respects:
 *  - face.anchor:                 'end' reverses the visual section order so S01 is on the right
 *  - face.slotNumberingDirection: 'rtl' numbers slots N…1 left-to-right within each section
 *
 * This ensures the preview matches the generated cell addresses visible in Address Preview.
 */
export function FrontElevationPreview({
  face,
  side,
}: {
  face: Pick<RackFace, 'sections' | 'anchor' | 'slotNumberingDirection'>;
  side: 'A' | 'B';
}) {
  const colors = FACE_COLORS[side];
  const { sections, anchor, slotNumberingDirection } = face;

  if (sections.length === 0) {
    return (
      <div className="flex h-16 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
        No sections
      </div>
    );
  }

  // Apply anchor: 'end' → reverse so the address-ordinal-1 section is shown on the LEFT
  // (matching the address preview which lists addresses starting from ordinal 1)
  const orderedSections = anchor === 'end' ? [...sections].reverse() : sections;

  const maxLevels = Math.max(...orderedSections.map((s) => s.levels.length), 1);
  const totalSlots = orderedSections.reduce((sum, s) => sum + (s.levels[0]?.slotCount ?? 1), 0);

  // Layout constants
  const svgHeight = 80;
  const headerH   = 14;
  const bodyH     = svgHeight - headerH;
  const cellH     = bodyH / maxLevels;

  // Build section column widths proportional to their slot count
  const sectionWidthRatios = orderedSections.map(
    (s) => (s.levels[0]?.slotCount ?? 1) / Math.max(totalSlots, 1)
  );

  const isRtl = slotNumberingDirection === 'rtl';

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <svg
        viewBox={`0 0 100 ${svgHeight}`}
        preserveAspectRatio="none"
        width="100%"
        height={svgHeight}
        aria-label={`Front elevation preview — Face ${side}`}
      >
        {/* Render each section as a column (left = address ordinal 1) */}
        {(() => {
          let xCursor = 0;
          return orderedSections.map((section, si) => {
            const addressOrdinal = si + 1; // 1-based, respects anchor reversal above
            const colW      = sectionWidthRatios[si] * 100;
            const levelCount = section.levels.length;
            const slotCount  = section.levels[0]?.slotCount ?? 1;

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
                  S{String(addressOrdinal).padStart(2, '0')}
                </text>

                {/* Level rows — rendered bottom-to-top (L1 at bottom) */}
                {Array.from({ length: levelCount }, (_, li) => {
                  const rowIndex = levelCount - 1 - li; // flip so L1 is bottom
                  const y        = headerH + rowIndex * cellH;
                  const slotW    = colW / slotCount;

                  return (
                    <g key={li}>
                      {Array.from({ length: slotCount }, (__, slotIdx) => {
                        // For RTL: physical position 0 (leftmost) → slot N, rightmost → slot 1
                        const slotLabel = isRtl ? slotCount - slotIdx : slotIdx + 1;

                        return (
                          <g key={slotIdx}>
                            <rect
                              x={xCursor + slotIdx * slotW + 0.3}
                              y={y + 0.3}
                              width={slotW - 0.6}
                              height={cellH - 0.6}
                              fill={colors.cell}
                              stroke={colors.border}
                              strokeWidth={0.4}
                              rx={0.5}
                            />
                            {/* Show slot number when cells are wide enough */}
                            {slotW > 8 && cellH > 9 && (
                              <text
                                x={xCursor + slotIdx * slotW + slotW / 2}
                                y={y + cellH / 2 + 2.5}
                                textAnchor="middle"
                                fontSize={5}
                                fill={colors.text}
                                fontFamily="monospace"
                                opacity={0.8}
                              >
                                {slotLabel}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                })}

                {/* Section right border */}
                {si < orderedSections.length - 1 && (
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
          {anchor === 'end' && <span className="ml-1 text-amber-500">· ↩ anchor end</span>}
          {isRtl && <span className="ml-1 text-amber-500">· rtl</span>}
        </span>
      </div>
    </div>
  );
}
