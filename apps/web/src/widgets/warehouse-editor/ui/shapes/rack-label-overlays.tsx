import { Group, Text } from 'react-konva';

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

export function SectionLabelOverlay({
  sectionNumber,
  geometry
}: {
  sectionNumber: number;
  geometry: LabelGeometry;
}) {
  const text = String(sectionNumber);
  const fontSize = 10;
  if (
    !canRenderLabel(text, geometry, {
      fontSize,
      minWidth: 16,
      minHeight: 14,
      padX: 3,
      padY: 2
    })
  ) {
    return null;
  }

  return (
    <Text
      x={geometry.x}
      y={geometry.y + Math.max(0, (geometry.height - fontSize) / 2)}
      width={geometry.width}
      text={text}
      fontSize={fontSize}
      fontStyle="bold"
      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      fill={SECTION_LABEL_COLOR}
      align="center"
      listening={false}
      opacity={0.9}
    />
  );
}

export function FaceTokenRailLabel({
  faceToken,
  geometry
}: {
  faceToken: 'A' | 'B';
  geometry: LabelGeometry;
}) {
  const fontSize = 10;
  if (
    !canRenderLabel(faceToken, geometry, {
      fontSize,
      minWidth: 14,
      minHeight: 12,
      padX: 2,
      padY: 1
    })
  ) {
    return null;
  }

  return (
    <Text
      x={geometry.x}
      y={geometry.y + Math.max(0, (geometry.height - fontSize) / 2)}
      width={geometry.width}
      text={faceToken}
      fontSize={fontSize}
      fontStyle="bold"
      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      fill={FACE_TOKEN_LABEL_COLOR}
      align="left"
      listening={false}
      opacity={0.9}
      name="face-token-label"
    />
  );
}

export function CellInteriorSlotLabel({
  slotNumber,
  geometry
}: {
  slotNumber: number;
  geometry: LabelGeometry;
}) {
  const slotText = String(slotNumber);
  const slotFontSize = 9;
  const canRenderSlot = canRenderLabel(slotText, geometry, {
    fontSize: slotFontSize,
    minWidth: 12,
    minHeight: 10,
    padX: 2,
    padY: 1
  });

  if (!canRenderSlot) return null;

  return (
    <Group listening={false}>
      <Text
        x={geometry.x}
        y={geometry.y + 1}
        width={geometry.width}
        text={slotText}
        fontSize={slotFontSize}
        fontStyle="bold"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fill={SLOT_LABEL_COLOR}
        align="center"
        opacity={0.92}
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
