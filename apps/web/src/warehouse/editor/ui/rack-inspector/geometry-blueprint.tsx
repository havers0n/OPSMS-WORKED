import { useState } from 'react';
import type { Rack } from '@wos/domain';
import {
  useRotateRack,
  useUpdateRackGeneral
} from '@/warehouse/editor/model/editor-selectors';

type ActiveEditor = 'length' | 'depth' | null;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rotatePoint(x: number, y: number, deg: number, cx: number, cy: number) {
  if (deg === 0) {
    return { x, y };
  }

  const radians = (deg * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos
  };
}

function parsePositiveNumber(rawValue: string) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function GeometryBlueprint({ rack, readOnly = false }: { rack: Rack; readOnly?: boolean }) {
  const updateRackGeneral = useUpdateRackGeneral();
  const rotateRack = useRotateRack();

  const [activeEditor, setActiveEditor] = useState<ActiveEditor>(null);
  const [draftValue, setDraftValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const WIDTH = 220;
  const HEIGHT = 200;
  const PADDING = 20;
  const SVG_WIDTH = WIDTH - PADDING * 2;
  const SVG_HEIGHT = HEIGHT - PADDING * 2;

  const normalizedRotation = ((rack.rotationDeg ?? 0) % 360 + 360) % 360;
  const safeLength = Math.max(rack.totalLength, 0.1);
  const safeDepth = Math.max(rack.depth, 0.1);
  const aspect = safeLength / safeDepth;
  let rectW = SVG_WIDTH;
  let rectH = SVG_HEIGHT;

  if (aspect > SVG_WIDTH / SVG_HEIGHT) {
    rectH = rectW / aspect;
  } else {
    rectW = rectH * aspect;
  }

  const offsetX = PADDING + (SVG_WIDTH - rectW) / 2;
  const offsetY = PADDING + (SVG_HEIGHT - rectH) / 2;
  const centerX = offsetX + rectW / 2;
  const centerY = offsetY + rectH / 2;
  const dimOffset = 10;
  const dimTick = 4;
  const dimLabelOffset = 4;
  const labelWidth = 58;
  const labelHeight = 18;
  const rotationChipWidth = 92;
  const rotationChipHeight = 18;
  const rotationChipX = WIDTH / 2 - 52;
  const rotationChipY = HEIGHT - PADDING - 22;
  const labelGap = 8;

  const getRotationLabel = () => {
    if (normalizedRotation === 0) return '0°';
    if (normalizedRotation === 90) return '90°';
    if (normalizedRotation === 180) return '180°';
    if (normalizedRotation === 270) return '270°';
    return `${normalizedRotation}°`;
  };

  const lengthTextX = clamp(centerX, PADDING + 30, WIDTH - PADDING - 30);
  const lengthTextY = clamp(offsetY - dimOffset - dimLabelOffset, PADDING + 12, HEIGHT - PADDING - 12);
  const depthTextX = clamp(offsetX - dimOffset - dimLabelOffset, PADDING + 14, WIDTH - PADDING - 14);
  const depthTextY = clamp(centerY, PADDING + 12, HEIGHT - PADDING - 12);

  const rotatedLengthPoint = rotatePoint(lengthTextX, lengthTextY, normalizedRotation, centerX, centerY);
  const rotatedDepthPoint = rotatePoint(depthTextX, depthTextY, normalizedRotation, centerX, centerY);
  const labelHalfW = labelWidth / 2;
  const labelHalfH = labelHeight / 2;

  const placeLabel = (rawX: number, rawY: number) => {
    const x = clamp(rawX, PADDING + labelHalfW + 2, WIDTH - PADDING - labelHalfW - 2);
    let y = clamp(rawY, PADDING + labelHalfH + 2, HEIGHT - PADDING - labelHalfH - 2);

    const overlapsRotationChip =
      Math.abs(x - (rotationChipX + rotationChipWidth / 2)) <= (labelHalfW + rotationChipWidth / 2 + labelGap) &&
      Math.abs(y - (rotationChipY + rotationChipHeight / 2)) <= (labelHalfH + rotationChipHeight / 2 + labelGap);

    if (overlapsRotationChip) {
      const liftedY = rotationChipY - labelGap - labelHalfH;
      y = clamp(liftedY, PADDING + labelHalfH + 2, HEIGHT - PADDING - labelHalfH - 2);
    }

    return { x, y };
  };

  const lengthPlaced = placeLabel(rotatedLengthPoint.x, rotatedLengthPoint.y);
  const depthPlacedInitial = placeLabel(rotatedDepthPoint.x, rotatedDepthPoint.y);

  let depthPlaced = depthPlacedInitial;
  const labelsOverlap =
    Math.abs(lengthPlaced.x - depthPlaced.x) <= (labelWidth + labelGap) &&
    Math.abs(lengthPlaced.y - depthPlaced.y) <= (labelHeight + labelGap);

  if (labelsOverlap) {
    const tryDown = clamp(
      depthPlaced.y + labelHeight + labelGap,
      PADDING + labelHalfH + 2,
      HEIGHT - PADDING - labelHalfH - 2
    );
    const tryUp = clamp(
      depthPlaced.y - labelHeight - labelGap,
      PADDING + labelHalfH + 2,
      HEIGHT - PADDING - labelHalfH - 2
    );
    const downDistance = Math.abs(tryDown - depthPlaced.y);
    const upDistance = Math.abs(tryUp - depthPlaced.y);
    depthPlaced = {
      x: depthPlaced.x,
      y: downDistance >= upDistance ? tryDown : tryUp
    };
  }

  const lengthLabelX = lengthPlaced.x;
  const lengthLabelY = lengthPlaced.y;
  const depthLabelX = depthPlaced.x;
  const depthLabelY = depthPlaced.y;

  const openEditor = (field: Exclude<ActiveEditor, null>) => {
    if (readOnly) return;
    setValidationError(null);
    setActiveEditor(field);
    setDraftValue(field === 'length' ? String(rack.totalLength) : String(rack.depth));
  };

  const closeEditor = () => {
    setActiveEditor(null);
    setDraftValue('');
    setValidationError(null);
  };

  const commitEditor = () => {
    if (!activeEditor) return true;

    const parsedValue = parsePositiveNumber(draftValue);
    if (parsedValue === null) {
      setValidationError('Enter a valid number > 0');
      return false;
    }

    if (activeEditor === 'length') {
      updateRackGeneral(rack.id, { totalLength: parsedValue });
    } else {
      updateRackGeneral(rack.id, { depth: parsedValue });
    }

    closeEditor();
    return true;
  };

  const handleRotationAction = () => {
    if (readOnly) return;
    closeEditor();
    rotateRack(rack.id);
  };

  const activeAnchor =
    activeEditor === 'length'
      ? { x: lengthLabelX, y: lengthLabelY }
      : { x: depthLabelX, y: depthLabelY };
  const editorWidth = 112;
  const editorHeight = 42;
  const editorX = clamp(activeAnchor.x - editorWidth / 2, PADDING, WIDTH - PADDING - editorWidth);
  const editorY = clamp(activeAnchor.y + 10, PADDING, HEIGHT - PADDING - editorHeight);

  const isLengthEditing = activeEditor === 'length';
  const isDepthEditing = activeEditor === 'depth';

  return (
    <div className="rounded-[14px] border border-[var(--border-muted)] bg-white p-4 shadow-sm">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Top-Down View
      </div>
      <svg
        data-testid="geometry-blueprint-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full bg-slate-50 rounded-lg"
        style={{ maxHeight: '200px' }}
      >
        <g
          data-testid="geometry-blueprint-rack-group"
          transform={`rotate(${normalizedRotation} ${centerX} ${centerY})`}
        >
          <line
            x1={offsetX}
            y1={offsetY - dimOffset}
            x2={offsetX + rectW}
            y2={offsetY - dimOffset}
            stroke="#cbd5e1"
            strokeWidth="1"
          />
          <line
            x1={offsetX}
            y1={offsetY - dimOffset - dimTick}
            x2={offsetX}
            y2={offsetY - dimOffset + dimTick}
            stroke="#cbd5e1"
            strokeWidth="1"
          />
          <line
            x1={offsetX + rectW}
            y1={offsetY - dimOffset - dimTick}
            x2={offsetX + rectW}
            y2={offsetY - dimOffset + dimTick}
            stroke="#cbd5e1"
            strokeWidth="1"
          />

          <rect
            data-testid="geometry-blueprint-rack-rect"
            x={offsetX}
            y={offsetY}
            width={rectW}
            height={rectH}
            fill="none"
            stroke="#1e293b"
            strokeWidth="2"
            rx="2"
          />

          <line
            x1={offsetX - dimOffset}
            y1={offsetY}
            x2={offsetX - dimOffset}
            y2={offsetY + rectH}
            stroke="#cbd5e1"
            strokeWidth="1"
          />
          <line
            x1={offsetX - dimOffset - dimTick}
            y1={offsetY}
            x2={offsetX - dimOffset + dimTick}
            y2={offsetY}
            stroke="#cbd5e1"
            strokeWidth="1"
          />
          <line
            x1={offsetX - dimOffset - dimTick}
            y1={offsetY + rectH}
            x2={offsetX - dimOffset + dimTick}
            y2={offsetY + rectH}
            stroke="#cbd5e1"
            strokeWidth="1"
          />

          <g data-testid="geometry-blueprint-arrow-group" transform={`translate(${centerX}, ${centerY})`}>
            <circle cx="0" cy="0" r="12" fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="0" y1="-12" x2="0" y2="-18" stroke="#3b82f6" strokeWidth="2" />
            <polygon points="0,-18 -3,-14 3,-14" fill="#3b82f6" />
          </g>
        </g>

        <g
          data-testid="geometry-blueprint-length-action"
          onClick={() => openEditor('length')}
          style={{ cursor: readOnly ? 'default' : 'pointer' }}
          transform={`translate(${lengthLabelX} ${lengthLabelY})`}
        >
          <rect
            x={-labelHalfW}
            y={-labelHalfH}
            width={labelWidth}
            height={labelHeight}
            rx="8"
            fill={isLengthEditing ? '#dbeafe' : '#ffffff'}
            stroke={readOnly ? '#cbd5e1' : '#94a3b8'}
            strokeWidth="1"
          />
          <text
            data-testid="geometry-blueprint-length-label"
            x="0"
            y="3"
            textAnchor="middle"
            className="text-[10px] fill-slate-700"
          >
            {`${rack.totalLength.toFixed(1)}m`}
          </text>
        </g>

        <g
          data-testid="geometry-blueprint-depth-action"
          onClick={() => openEditor('depth')}
          style={{ cursor: readOnly ? 'default' : 'pointer' }}
          transform={`translate(${depthLabelX} ${depthLabelY})`}
        >
          <rect
            x={-labelHalfW}
            y={-labelHalfH}
            width={labelWidth}
            height={labelHeight}
            rx="8"
            fill={isDepthEditing ? '#dbeafe' : '#ffffff'}
            stroke={readOnly ? '#cbd5e1' : '#94a3b8'}
            strokeWidth="1"
          />
          <text
            data-testid="geometry-blueprint-depth-label"
            x="0"
            y="3"
            textAnchor="middle"
            className="text-[10px] fill-slate-700"
          >
            {`${rack.depth.toFixed(1)}m`}
          </text>
        </g>

        <g
          data-testid="geometry-blueprint-rotation-action"
          onMouseDown={(event) => event.preventDefault()}
          onClick={handleRotationAction}
          style={{ cursor: readOnly ? 'default' : 'pointer' }}
        >
          <rect
            x={rotationChipX}
            y={rotationChipY}
            width={rotationChipWidth}
            height={rotationChipHeight}
            rx="8"
            fill={readOnly ? '#f8fafc' : '#ffffff'}
            stroke={readOnly ? '#cbd5e1' : '#94a3b8'}
            strokeWidth="1"
          />
          <text
            data-testid="geometry-blueprint-rotation-label"
            x={WIDTH / 2}
            y={HEIGHT - PADDING - 10}
            textAnchor="middle"
            className="text-[10px] fill-slate-700 font-semibold"
          >
            {`Rotation: ${getRotationLabel()}`}
          </text>
        </g>

        {activeEditor && (
          <foreignObject
            data-testid="geometry-blueprint-inline-editor"
            x={editorX}
            y={editorY}
            width={editorWidth}
            height={editorHeight}
          >
            <div className="h-full w-full rounded-md border border-slate-300 bg-white/95 p-1 shadow">
              <input
                data-testid="geometry-blueprint-inline-input"
                autoFocus
                value={draftValue}
                onChange={(event) => {
                  setDraftValue(event.target.value);
                  if (validationError) setValidationError(null);
                }}
                onBlur={() => {
                  void commitEditor();
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void commitEditor();
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    closeEditor();
                  }
                }}
                className="h-6 w-full rounded border border-slate-300 px-1 text-[11px] text-slate-700"
              />
              {validationError && (
                <div data-testid="geometry-blueprint-inline-error" className="mt-0.5 text-[10px] text-red-600">
                  {validationError}
                </div>
              )}
            </div>
          </foreignObject>
        )}
      </svg>
    </div>
  );
}
