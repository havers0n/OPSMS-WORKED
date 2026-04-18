import { Group, Text } from 'react-konva';
import type { LabelProminence } from './rack-label-reveal-policy';

type LabelGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type LabelFitOptions = {
  fontSize: number;
  minWidth: number;
  minHeight: number;
  padX: number;
  padY: number;
};

function canRenderLabel(text: string, geometry: LabelGeometry, options: LabelFitOptions): boolean {
  if (!text.trim()) return false;
  if (geometry.width < options.minWidth || geometry.height < options.minHeight) return false;
  const estimatedTextWidth = text.length * options.fontSize * 0.58;
  return (
    geometry.width >= estimatedTextWidth + options.padX * 2 &&
    geometry.height >= options.fontSize + options.padY * 2
  );
}

const SECTION_LABEL_COLOR = '#0f172a';
const FACE_TOKEN_LABEL_COLOR = '#0f172a';
const SLOT_LABEL_COLOR = '#0f172a';
const ADDRESS_LABEL_COLOR = '#1e293b';

function getProminenceTextStyle(
  prominence: LabelProminence,
  baseFontSize: number
): { fontSize: number; fontStyle: 'bold' | 'normal'; opacity: number } {
  if (prominence === 'secondary') {
    return {
      fontSize: Math.max(8, baseFontSize - 1),
      fontStyle: 'bold',
      opacity: 0.72
    };
  }
  if (prominence === 'background') {
    return {
      fontSize: Math.max(8, baseFontSize - 2),
      fontStyle: 'normal',
      opacity: 0.52
    };
  }

  return {
    fontSize: baseFontSize,
    fontStyle: 'bold',
    opacity: 0.9
  };
}

export function SectionLabelOverlay({
  sectionNumber,
  geometry,
  prominence = 'dominant',
  counterRotationDeg = 0
}: {
  sectionNumber: number;
  geometry: LabelGeometry;
  prominence?: LabelProminence;
  counterRotationDeg?: 0 | 90 | 180 | 270;
}) {
  const text = String(sectionNumber);
  const style = getProminenceTextStyle(prominence, 10);
  if (
    !canRenderLabel(text, geometry, {
      fontSize: style.fontSize,
      minWidth: 16,
      minHeight: 14,
      padX: 3,
      padY: 2
    })
  ) {
    return null;
  }

  const centerX = geometry.x + geometry.width / 2;
  const textY = -geometry.height / 2 + Math.max(0, (geometry.height - style.fontSize) / 2);

  return (
    <Group x={centerX} y={geometry.y + geometry.height / 2} rotation={-counterRotationDeg} listening={false} name="section-label-rotator">
      <Text
        x={-geometry.width / 2}
        y={textY}
        width={geometry.width}
        text={text}
        fontSize={style.fontSize}
        fontStyle={style.fontStyle}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fill={SECTION_LABEL_COLOR}
        align="center"
        listening={false}
        opacity={style.opacity}
        name="section-label"
      />
    </Group>
  );
}

export function FaceTokenRailLabel({
  faceToken,
  geometry,
  prominence = 'dominant',
  counterRotationDeg = 0
}: {
  faceToken: 'A' | 'B';
  geometry: LabelGeometry;
  prominence?: LabelProminence;
  counterRotationDeg?: 0 | 90 | 180 | 270;
}) {
  const style = getProminenceTextStyle(prominence, 10);
  if (
    !canRenderLabel(faceToken, geometry, {
      fontSize: style.fontSize,
      minWidth: 14,
      minHeight: 12,
      padX: 2,
      padY: 1
    })
  ) {
    return null;
  }

  const centerX = geometry.x + geometry.width / 2;
  const textY = -geometry.height / 2 + Math.max(0, (geometry.height - style.fontSize) / 2);

  return (
    <Group x={centerX} y={geometry.y + geometry.height / 2} rotation={-counterRotationDeg} listening={false} name="face-token-label-rotator">
      <Text
        x={-geometry.width / 2}
        y={textY}
        width={geometry.width}
        text={faceToken}
        fontSize={style.fontSize}
        fontStyle={style.fontStyle}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fill={FACE_TOKEN_LABEL_COLOR}
        align="left"
        listening={false}
        opacity={style.opacity}
        name="face-token-label"
      />
    </Group>
  );
}

export function CellInteriorSlotLabel({
  slotNumber,
  geometry,
  prominence = 'dominant',
  counterRotationDeg = 0
}: {
  slotNumber: number;
  geometry: LabelGeometry;
  prominence?: LabelProminence;
  counterRotationDeg?: 0 | 90 | 180 | 270;
}) {
  const slotText = String(slotNumber);
  const style = getProminenceTextStyle(prominence, 9);
  const canRenderSlot = canRenderLabel(slotText, geometry, {
    fontSize: style.fontSize,
    minWidth: 12,
    minHeight: 10,
    padX: 2,
    padY: 1
  });

  if (!canRenderSlot) return null;

  return (
    <Group
      x={geometry.x + geometry.width / 2}
      y={geometry.y + geometry.height / 2}
      rotation={-counterRotationDeg}
      listening={false}
      name="slot-label-rotator"
    >
      <Text
        x={-geometry.width / 2}
        y={-geometry.height / 2 + 1}
        width={geometry.width}
        text={slotText}
        fontSize={style.fontSize}
        fontStyle={style.fontStyle}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fill={SLOT_LABEL_COLOR}
        align="center"
        opacity={style.opacity}
        name="slot-label"
      />
    </Group>
  );
}

export function FocusedCellAddressOverlay({
  addressText,
  geometry
}: {
  addressText: string;
  geometry: LabelGeometry;
}) {
  const addressFontSize = 8;
  const canRenderAddress =
    canRenderLabel(addressText, geometry, {
      fontSize: addressFontSize,
      minWidth: 38,
      minHeight: 18,
      padX: 2,
      padY: 1
    }) && geometry.height >= addressFontSize + 6;

  if (!canRenderAddress) return null;

  return (
    <Group listening={false}>
      <Text
        x={geometry.x}
        y={geometry.y + geometry.height - addressFontSize - 1}
        width={geometry.width}
        text={addressText}
        fontSize={addressFontSize}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fill={ADDRESS_LABEL_COLOR}
        align="center"
        opacity={0.85}
        name="focused-address-label"
      />
    </Group>
  );
}
