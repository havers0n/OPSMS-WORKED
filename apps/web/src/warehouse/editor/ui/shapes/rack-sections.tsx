import { Group, Rect, Shape } from 'react-konva';
import { isRackFaceMirrored, type RackFace } from '@wos/domain';
import { getSectionWidths, type CanvasRackGeometry } from '@/entities/layout-version/lib/canvas-geometry';
import { FaceTokenRailLabel, SectionLabelOverlay } from './rack-label-overlays';
import type { LabelProminence } from './rack-label-reveal-policy';

type Props = {
  geometry: CanvasRackGeometry;
  faceA: RackFace;
  faceB: RackFace | null;
  isSelected: boolean;
  isPassive?: boolean;
  rackRotationDeg?: 0 | 90 | 180 | 270;
  showFaceToken: boolean;
  showSectionNumbers: boolean;
  faceTokenProminence: LabelProminence;
  sectionNumberProminence: LabelProminence;
  disableStrokes?: boolean;
  isActivelyPanning?: boolean;
};

const DIVIDER_STROKE = '#94a3b8';
const DIVIDER_STROKE_SEL = '#0f6a8e';
const SECTION_FILL_A_SEL = 'rgba(14, 165, 233, 0.12)';
const SECTION_FILL_B_SEL = 'rgba(124, 58, 237, 0.12)';
const FACE_TOKEN_RAIL_TOP_INSET = 2;
const FACE_TOKEN_RAIL_LEFT_INSET = 6;
const FACE_TOKEN_RAIL_HEIGHT = 12;
const FACE_TOKEN_RAIL_WIDTH = 20;
const SECTION_LABEL_RAIL_TOP_INSET = 6;
const SECTION_LABEL_RAIL_HEIGHT = 14;

export function RackSections({
  geometry,
  faceA,
  faceB,
  isSelected,
  isPassive = false,
  rackRotationDeg = 0,
  showFaceToken,
  showSectionNumbers,
  faceTokenProminence,
  sectionNumberProminence,
  disableStrokes = false,
  isActivelyPanning = false
}: Props) {
  const { faceAWidth, faceBWidth, height, isPaired, spineY } = geometry;
  const divider = isSelected ? DIVIDER_STROKE_SEL : DIVIDER_STROKE;
  const lightweightVisuals = disableStrokes || isActivelyPanning;
  const faceBSections =
    faceB && isRackFaceMirrored(faceB) && faceB.mirrorSourceFaceId === faceA.id
      ? faceA.sections
      : (faceB?.sections ?? []);

  const faceAOffsets = getSectionWidths(faceAWidth, faceA.sections);
  const faceBOffsets = getSectionWidths(faceBWidth, faceBSections.length > 0 ? faceBSections : faceA.sections);

  const faceABottom = isPaired ? spineY : height;
  const faceBTop = spineY;
  const dividerStrokeWidth = isSelected ? 1.5 : 1;
  const dividerOpacity = isSelected ? 0.9 : 0.5;
  const faceADividerXs = !lightweightVisuals ? faceAOffsets.slice(1, -1) : [];
  const faceBDividerXs = isPaired && !lightweightVisuals ? faceBOffsets.slice(1, -1) : [];

  return (
    <Group listening={false} opacity={isPassive && !isSelected ? 0.45 : 1}>
      {isSelected && faceA.sections.map((sec, i) => {
        const x0 = faceAOffsets[i];
        const x1 = faceAOffsets[i + 1];
        const sectionW = x1 - x0;
        if (sectionW < 8) return null;

        return (
          <Rect
            key={`sa-fill-${sec.id}`}
            x={x0 + 1}
            y={4}
            width={Math.max(1, sectionW - 2)}
            height={Math.max(1, faceABottom - 8)}
            fill={SECTION_FILL_A_SEL}
            cornerRadius={4}
            visible={!lightweightVisuals}
            opacity={lightweightVisuals ? 0 : 1}
            wosRectRole="rack-section"
          />
        );
      })}

      {faceADividerXs.length > 0 && (
        <Shape
          listening={false}
          opacity={dividerOpacity}
          sceneFunc={(context, shape) => {
            context.save();
            context.strokeStyle = divider;
            context.lineWidth = dividerStrokeWidth;
            context.setLineDash([4, 3]);
            faceADividerXs.forEach((x) => {
              context.beginPath();
              context.moveTo(x, 4);
              context.lineTo(x, faceABottom - 4);
              context.stroke();
            });
            context.restore();
            context.fillStrokeShape(shape);
          }}
        />
      )}

      {isPaired && showFaceToken && (
        <FaceTokenRailLabel
          faceToken="A"
          geometry={{
            x: FACE_TOKEN_RAIL_LEFT_INSET,
            y: FACE_TOKEN_RAIL_TOP_INSET,
            width: Math.min(FACE_TOKEN_RAIL_WIDTH, Math.max(0, faceAWidth - FACE_TOKEN_RAIL_LEFT_INSET - 2)),
          height: Math.min(FACE_TOKEN_RAIL_HEIGHT, Math.max(0, faceABottom - FACE_TOKEN_RAIL_TOP_INSET - 2))
        }}
        prominence={faceTokenProminence}
        counterRotationDeg={rackRotationDeg}
      />
      )}

      {showSectionNumbers && faceA.sections.map((sec, i) => {
        const x0 = faceAOffsets[i];
        const x1 = faceAOffsets[i + 1];
        const sectionW = x1 - x0;
        const sectionTop = 4;
        const sectionBottom = faceABottom - 4;
        const railHeight = Math.max(
          0,
          Math.min(SECTION_LABEL_RAIL_HEIGHT, sectionBottom - sectionTop - SECTION_LABEL_RAIL_TOP_INSET)
        );
        return (
          <SectionLabelOverlay
            key={`sa-label-${sec.id}`}
            sectionNumber={sec.ordinal}
            geometry={{
              x: x0 + 1,
              y: sectionTop + SECTION_LABEL_RAIL_TOP_INSET,
              width: Math.max(1, sectionW - 2),
              height: railHeight
            }}
            prominence={sectionNumberProminence}
            counterRotationDeg={rackRotationDeg}
          />
        );
      })}

      {isSelected && isPaired && faceB && faceBSections.map((sec, i) => {
        const x0 = faceBOffsets[i];
        const x1 = faceBOffsets[i + 1];
        const sectionW = x1 - x0;
        if (sectionW < 8) return null;

        return (
          <Rect
            key={`sb-fill-${sec.id}`}
            x={x0 + 1}
            y={faceBTop + 4}
            width={Math.max(1, sectionW - 2)}
            height={Math.max(1, height - faceBTop - 8)}
            fill={SECTION_FILL_B_SEL}
            cornerRadius={4}
            visible={!lightweightVisuals}
            opacity={lightweightVisuals ? 0 : 1}
            wosRectRole="rack-section"
          />
        );
      })}

      {faceBDividerXs.length > 0 && (
        <Shape
          listening={false}
          opacity={dividerOpacity}
          sceneFunc={(context, shape) => {
            context.save();
            context.strokeStyle = divider;
            context.lineWidth = dividerStrokeWidth;
            context.setLineDash([4, 3]);
            faceBDividerXs.forEach((x) => {
              context.beginPath();
              context.moveTo(x, faceBTop + 4);
              context.lineTo(x, height - 4);
              context.stroke();
            });
            context.restore();
            context.fillStrokeShape(shape);
          }}
        />
      )}

      {isPaired && faceB && showFaceToken && (
        <FaceTokenRailLabel
          faceToken="B"
          geometry={{
            x: FACE_TOKEN_RAIL_LEFT_INSET,
            y: faceBTop + FACE_TOKEN_RAIL_TOP_INSET,
            width: Math.min(FACE_TOKEN_RAIL_WIDTH, Math.max(0, faceBWidth - FACE_TOKEN_RAIL_LEFT_INSET - 2)),
            height: Math.min(FACE_TOKEN_RAIL_HEIGHT, Math.max(0, height - faceBTop - FACE_TOKEN_RAIL_TOP_INSET - 2))
          }}
          prominence={faceTokenProminence}
          counterRotationDeg={rackRotationDeg}
        />
      )}

      {showSectionNumbers && isPaired && faceB && faceBSections.map((sec, i) => {
        const x0 = faceBOffsets[i];
        const x1 = faceBOffsets[i + 1];
        const sectionW = x1 - x0;
        const sectionTop = faceBTop + 4;
        const sectionBottom = height - 4;
        const railHeight = Math.max(
          0,
          Math.min(SECTION_LABEL_RAIL_HEIGHT, sectionBottom - sectionTop - SECTION_LABEL_RAIL_TOP_INSET)
        );
        return (
          <SectionLabelOverlay
            key={`sb-label-${sec.id}`}
            sectionNumber={sec.ordinal}
            geometry={{
              x: x0 + 1,
              y: sectionTop + SECTION_LABEL_RAIL_TOP_INSET,
              width: Math.max(1, sectionW - 2),
              height: railHeight
            }}
            prominence={sectionNumberProminence}
            counterRotationDeg={rackRotationDeg}
          />
        );
      })}
    </Group>
  );
}
