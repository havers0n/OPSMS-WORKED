// Map rendering components
const { useState, useRef, useEffect, useCallback, useMemo } = React;

// SVG patterns used for status fills
function SvgDefs() {
  return (
    <defs>
      <pattern id="pat-block" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="var(--s-blocked)" />
        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--s-blocked-line)" strokeWidth="2" />
      </pattern>
      <pattern id="pat-invent" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="var(--s-inventory)" />
        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--s-inventory-line)" strokeWidth="1.5" />
      </pattern>
      <pattern id="pat-reserve" width="5" height="5" patternUnits="userSpaceOnUse">
        <rect width="5" height="5" fill="var(--s-reserved)" />
        <circle cx="2.5" cy="2.5" r="0.7" fill="var(--s-reserved-line)" />
      </pattern>
      <pattern id="pat-wall" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="8" height="8" fill="var(--wall)" />
        <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      </pattern>
      <pattern id="pat-floor" width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill="none" />
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--line-2)" strokeWidth="0.5" />
      </pattern>
      <filter id="glow-select" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="3" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

function Zone({ zone, lang }) {
  return (
    <g className="zone">
      <rect
        x={zone.x} y={zone.y} width={zone.w} height={zone.h}
        fill={zone.color} opacity="0.12"
        stroke={zone.color} strokeOpacity="0.6" strokeWidth="1.5"
        strokeDasharray="6 4"
      />
      <text
        className="zone-watermark"
        x={zone.x + zone.w / 2} y={zone.y + zone.h / 2 + 4}
        textAnchor="middle"
        fill={zone.color}
      >
        {lang === 'en' ? zone.nameEn.toUpperCase() : zone.name}
      </text>
      <text
        className="zone-sublabel"
        x={zone.x + zone.w / 2} y={zone.y + zone.h / 2 + 24}
        textAnchor="middle"
        fill={zone.color}
      >
        {zone.id}
      </text>
    </g>
  );
}

function Walls() {
  return (
    <g>
      {WMS.WALLS.map((w, i) => (
        <rect key={i} x={w.x} y={w.y} width={w.w} height={w.h} fill="url(#pat-wall)" />
      ))}
      {WMS.COLUMNS.map((c, i) => (
        <g key={i}>
          <rect x={c.x - c.s/2} y={c.y - c.s/2} width={c.s} height={c.s} fill="var(--wall)" />
          <rect x={c.x - c.s/2 + 2} y={c.y - c.s/2 + 2} width={c.s - 4} height={c.s - 4} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
        </g>
      ))}
      {WMS.DOORS.map((d, i) => (
        <g key={i}>
          <rect x={d.x} y={d.y} width={d.w} height={d.h} fill="var(--bg)" stroke="var(--accent)" strokeWidth="1" strokeDasharray="3 2" />
          <text x={d.x + d.w/2} y={d.y + d.h/2 + 3} textAnchor="middle"
            fontSize="8" fontFamily="var(--font-mono)" fill="var(--accent)">
            {d.label}
          </text>
        </g>
      ))}
    </g>
  );
}

function RulerGrid({ visible }) {
  if (!visible) return null;
  const { xLabels, yLabels } = WMS.RULER;
  return (
    <g className="ruler">
      {/* top strip */}
      <rect x={360} y={260} width={660} height={18} fill="var(--bg-sunk)" stroke="var(--line)" strokeWidth="0.5" />
      {xLabels.map((l, i) => (
        <text key={i} x={l.x} y={273} textAnchor="middle" className="ruler-lbl">{l.label}</text>
      ))}
      {/* left strip */}
      <rect x={340} y={260} width={18} height={320} fill="var(--bg-sunk)" stroke="var(--line)" strokeWidth="0.5" />
      {yLabels.map((l, i) => (
        <text key={i} x={349} y={l.y + 3} textAnchor="middle" className="ruler-lbl">{l.label}</text>
      ))}
      {/* vertical grid lines inside rack area */}
      {xLabels.map((l, i) => (
        <line key={'v'+i} x1={360 + i * 60} y1={278} x2={360 + i * 60} y2={580}
          stroke="var(--line-2)" strokeWidth="0.5" strokeDasharray="2 3" />
      ))}
    </g>
  );
}

function Section({ section, selected, hovered, onHover, onClick, showLabels, pattern }) {
  const st = WMS.STATUSES[section.status];
  const usePattern = pattern === 'pattern' && st.pattern;
  const fill = usePattern ? `url(#pat-${st.pattern})` : st.fill;
  const isSelected = selected === section.id;
  const isHovered = hovered === section.id;

  // For partial: draw fill proportionally inside
  const fillWidth = section.status === 'partial' ? (section.w - 2) * (section.fill / 100) : section.w - 2;

  return (
    <g
      className="hover-target"
      onMouseEnter={(e) => onHover(section, e)}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => { e.stopPropagation(); onClick(section); }}
      style={{ cursor: 'pointer' }}
    >
      {/* base cell */}
      <rect
        x={section.x + 1} y={section.y + 1}
        width={section.w - 2} height={section.h - 2}
        fill={section.status === 'free' ? st.fill : 'var(--s-free)'}
        stroke={st.stroke}
        strokeWidth="0.8"
        strokeDasharray={st.dashed ? '3 2' : 'none'}
      />
      {/* status fill */}
      {section.status !== 'free' && (
        <rect
          x={section.x + 1} y={section.y + 1}
          width={fillWidth} height={section.h - 2}
          fill={fill}
        />
      )}
      {/* section divider line (right edge) */}
      <line
        x1={section.x + section.w} y1={section.y}
        x2={section.x + section.w} y2={section.y + section.h}
        stroke="var(--line-strong)" strokeWidth="0.5" opacity="0.7"
      />
      {/* label */}
      {showLabels && (
        <text
          x={section.x + section.w / 2}
          y={section.y + section.h / 2 + 3}
          textAnchor="middle"
          className="section-label"
        >
          {section.id.split('-')[1]}
        </text>
      )}
      {/* hover outline */}
      {isHovered && !isSelected && (
        <rect
          x={section.x} y={section.y}
          width={section.w} height={section.h}
          fill="none" stroke="var(--ink)" strokeWidth="1.5" opacity="0.6"
        />
      )}
      {/* selected outline */}
      {isSelected && (
        <>
          <rect
            x={section.x - 2} y={section.y - 2}
            width={section.w + 4} height={section.h + 4}
            fill="none" stroke="var(--accent)" strokeWidth="2"
            filter="url(#glow-select)"
          />
          <rect
            x={section.x} y={section.y}
            width={section.w} height={section.h}
            fill="none" stroke="var(--accent)" strokeWidth="1.2"
          />
        </>
      )}
    </g>
  );
}

function Rack({ rack, selected, hovered, onHoverSection, onClickSection, statusFilter, showSectionLabels, pattern }) {
  return (
    <g className="rack">
      {/* rack outline */}
      <rect
        x={rack.x - 1} y={rack.y - 1}
        width={rack.w + 2} height={rack.h + 2}
        fill="none"
        stroke="var(--ink-2)" strokeWidth="1.4"
      />
      {/* rack id label */}
      <g>
        {rack.labelPos === 'top' ? (
          <text
            className="rack-label"
            x={rack.x - 14}
            y={rack.y + rack.h / 2 + 4}
            textAnchor="end"
          >
            {rack.id}
          </text>
        ) : (
          <text
            className="rack-label"
            x={rack.x - 14}
            y={rack.y + rack.h / 2 + 4}
            textAnchor="end"
          >
            {rack.id}
          </text>
        )}
      </g>
      {/* sections */}
      {rack.sections.map((s) => {
        const dimmed = statusFilter && !statusFilter[s.status];
        return (
          <g key={s.id} opacity={dimmed ? 0.15 : 1} style={{ transition: 'opacity 0.2s' }}>
            <Section
              section={s}
              selected={selected}
              hovered={hovered}
              onHover={onHoverSection}
              onClick={onClickSection}
              showLabels={showSectionLabels}
              pattern={pattern}
            />
          </g>
        );
      })}
    </g>
  );
}

function FloorPallets({ cells, selected, hovered, onHover, onClick, statusFilter, pattern }) {
  return (
    <g>
      <text x={60} y={670} fontSize="9" fontFamily="var(--font-mono)" fill="var(--ink-3)" letterSpacing="0.5">
        PALLET STORAGE · P-01
      </text>
      {cells.map((c) => {
        const st = WMS.STATUSES[c.status];
        const dimmed = statusFilter && !statusFilter[c.status];
        const usePat = pattern === 'pattern' && st.pattern;
        const fill = usePat ? `url(#pat-${st.pattern})` : st.fill;
        const isSel = selected === c.id;
        const isHov = hovered === c.id;
        return (
          <g key={c.id}
            opacity={dimmed ? 0.15 : 1}
            onMouseEnter={(e) => onHover(c, e)}
            onMouseLeave={() => onHover(null)}
            onClick={(e) => { e.stopPropagation(); onClick(c); }}
            style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
            className="hover-target"
          >
            <rect
              x={c.x} y={c.y} width={c.w} height={c.h}
              fill={c.status === 'free' ? st.fill : fill}
              stroke={st.stroke}
              strokeWidth="1"
              strokeDasharray={st.dashed ? '3 2' : 'none'}
            />
            <text
              x={c.x + c.w / 2} y={c.y + c.h / 2 + 3}
              textAnchor="middle"
              fontSize="7"
              fontFamily="var(--font-mono)"
              fill={c.status === 'full' || c.status === 'blocked' ? '#fff' : 'var(--ink-2)'}
              opacity="0.85"
            >
              {c.id.replace('PAL-', '')}
            </text>
            {isHov && !isSel && (
              <rect x={c.x - 1} y={c.y - 1} width={c.w + 2} height={c.h + 2}
                fill="none" stroke="var(--ink)" strokeWidth="1.5" opacity="0.6" />
            )}
            {isSel && (
              <rect x={c.x - 2} y={c.y - 2} width={c.w + 4} height={c.h + 4}
                fill="none" stroke="var(--accent)" strokeWidth="2" filter="url(#glow-select)" />
            )}
          </g>
        );
      })}
    </g>
  );
}

// Main map SVG
function WarehouseMap({
  view, setView, lang, theme,
  hovered, selected, onHoverSection, onClickSection,
  statusFilter, showRuler, showLabels, pattern,
  stageRef,
}) {
  const svgRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);

  const onMouseDown = (e) => {
    // only primary button
    if (e.button !== 0) return;
    // don't drag when clicking on interactive element
    if (e.target.closest('.hover-target')) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  };
  const onMouseMove = (e) => {
    if (!dragging || !dragStart.current) return;
    const dx = (e.clientX - dragStart.current.x) / view.z;
    const dy = (e.clientY - dragStart.current.y) / view.z;
    setView(v => ({ ...v, x: dragStart.current.vx - dx, y: dragStart.current.vy - dy }));
  };
  const onMouseUp = () => {
    setDragging(false);
    dragStart.current = null;
  };

  const onWheel = (e) => {
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const worldX = view.x + mx / view.z;
    const worldY = view.y + my / view.z;
    const delta = -e.deltaY * 0.0015;
    const newZ = Math.max(0.3, Math.min(3, view.z * (1 + delta)));
    // keep cursor-world point fixed
    const newX = worldX - mx / newZ;
    const newY = worldY - my / newZ;
    setView({ x: newX, y: newY, z: newZ });
  };

  // attach wheel with passive:false
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const h = (e) => onWheel(e);
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  });

  // viewBox
  const vb = useMemo(() => {
    const el = stageRef.current;
    if (!el) return `0 0 1400 900`;
    const w = el.clientWidth / view.z;
    const h = el.clientHeight / view.z;
    return `${view.x} ${view.y} ${w} ${h}`;
  }, [view, stageRef]);

  return (
    <svg
      ref={svgRef}
      width="100%" height="100%"
      viewBox={vb}
      preserveAspectRatio="xMidYMid meet"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{ userSelect: 'none', cursor: dragging ? 'grabbing' : 'grab' }}
    >
      <SvgDefs />
      {/* floor grid */}
      <rect x={28} y={28} width={1344} height={844} fill="url(#pat-floor)" />
      {/* zones first (bg) */}
      {WMS.ZONES.map(z => <Zone key={z.id} zone={z} lang={lang} />)}
      {/* ruler */}
      <RulerGrid visible={showRuler} />
      {/* racks */}
      {WMS.RACKS.map(r => (
        <Rack
          key={r.id} rack={r}
          selected={selected?.id} hovered={hovered?.id}
          onHoverSection={onHoverSection}
          onClickSection={onClickSection}
          statusFilter={statusFilter}
          showSectionLabels={showLabels}
          pattern={pattern}
        />
      ))}
      {/* floor pallet cells */}
      <FloorPallets
        cells={WMS.FLOOR_CELLS}
        selected={selected?.id} hovered={hovered?.id}
        onHover={onHoverSection}
        onClick={onClickSection}
        statusFilter={statusFilter}
        pattern={pattern}
      />
      {/* walls + columns on top */}
      <Walls />

      {/* aisle arrows */}
      <g opacity="0.35">
        <text x={690} y={385} fontSize="9" fontFamily="var(--font-mono)"
          fill="var(--ink-3)" textAnchor="middle" letterSpacing="2">· AISLE 1 ·</text>
        <text x={690} y={505} fontSize="9" fontFamily="var(--font-mono)"
          fill="var(--ink-3)" textAnchor="middle" letterSpacing="2">· AISLE 2 ·</text>
      </g>
    </svg>
  );
}

window.WarehouseMap = WarehouseMap;
