import type { Rack } from '@wos/domain';

export function GeometryBlueprint({ rack }: { rack: Rack }) {
  const WIDTH = 220;
  const HEIGHT = 160;
  const PADDING = 20;
  const SVG_WIDTH = WIDTH - PADDING * 2;
  const SVG_HEIGHT = HEIGHT - PADDING * 2;

  const aspect = rack.totalLength / rack.depth;
  let rectW = SVG_WIDTH;
  let rectH = SVG_HEIGHT;

  if (aspect > SVG_WIDTH / SVG_HEIGHT) {
    rectH = rectW / aspect;
  } else {
    rectW = rectH * aspect;
  }

  const offsetX = PADDING + (SVG_WIDTH - rectW) / 2;
  const offsetY = PADDING + (SVG_HEIGHT - rectH) / 2;

  const getRotationLabel = () => {
    const deg = rack.rotationDeg ?? 0;
    if (deg === 0) return '0°';
    if (deg === 90) return '90°';
    if (deg === 180) return '180°';
    if (deg === 270) return '270°';
    return deg + '°';
  };

  return (
    <div className="rounded-[14px] border border-[var(--border-muted)] bg-white p-4 shadow-sm">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Top-Down View
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full bg-slate-50 rounded-lg"
        style={{ maxHeight: '140px' }}
      >
        {/* Dimension lines and labels */}
        <line
          x1={offsetX}
          y1={offsetY - 10}
          x2={offsetX + rectW}
          y2={offsetY - 10}
          stroke="#cbd5e1"
          strokeWidth="1"
        />
        <line x1={offsetX} y1={offsetY - 14} x2={offsetX} y2={offsetY - 6} stroke="#cbd5e1" strokeWidth="1" />
        <line
          x1={offsetX + rectW}
          y1={offsetY - 14}
          x2={offsetX + rectW}
          y2={offsetY - 6}
          stroke="#cbd5e1"
          strokeWidth="1"
        />
        <text
          x={offsetX + rectW / 2}
          y={offsetY - 15}
          textAnchor="middle"
          className="text-[10px] fill-slate-600"
        >
          {rack.totalLength.toFixed(1)}m
        </text>

        {/* Rack rectangle */}
        <rect
          x={offsetX}
          y={offsetY}
          width={rectW}
          height={rectH}
          fill="none"
          stroke="#1e293b"
          strokeWidth="2"
          rx="2"
        />

        {/* Depth indicator on side */}
        <line
          x1={offsetX - 10}
          y1={offsetY}
          x2={offsetX - 10}
          y2={offsetY + rectH}
          stroke="#cbd5e1"
          strokeWidth="1"
        />
        <line
          x1={offsetX - 14}
          y1={offsetY}
          x2={offsetX - 6}
          y2={offsetY}
          stroke="#cbd5e1"
          strokeWidth="1"
        />
        <line
          x1={offsetX - 14}
          y1={offsetY + rectH}
          x2={offsetX - 6}
          y2={offsetY + rectH}
          stroke="#cbd5e1"
          strokeWidth="1"
        />
        <text
          x={offsetX - 20}
          y={offsetY + rectH / 2}
          textAnchor="end"
          dominantBaseline="middle"
          className="text-[10px] fill-slate-600"
        >
          {rack.depth.toFixed(1)}m
        </text>

        {/* Rotation indicator arrow */}
        <g transform={`translate(${offsetX + rectW / 2}, ${offsetY + rectH / 2})`}>
          <circle cx="0" cy="0" r="12" fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2,2" />
          <line x1="0" y1="-12" x2="0" y2="-18" stroke="#3b82f6" strokeWidth="2" />
          <polygon points="0,-18 -2,-14 2,-14" fill="#3b82f6" />
        </g>

        {/* Rotation label */}
        <text
          x={offsetX + rectW + 8}
          y={offsetY + rectH + 18}
          className="text-[10px] fill-slate-600 font-semibold"
        >
          Rotation: {getRotationLabel()}
        </text>
      </svg>
    </div>
  );
}
