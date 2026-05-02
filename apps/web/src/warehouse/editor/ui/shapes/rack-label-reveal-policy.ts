import {
  LOD_CELL_THRESHOLD,
  LOD_SECTION_THRESHOLD,
  type CanvasLOD
} from '@/entities/layout-version/lib/canvas-geometry';

export type RevealStage = 0 | 1 | 2 | 3;
export type LabelProminence = 'dominant' | 'secondary' | 'background';
export type RackCodePlacement = 'header-left' | 'lower-left-mid';

export type RackLabelRevealPolicy = {
  revealStage: RevealStage;
  showRackCode: boolean;
  showFaceToken: boolean;
  showSectionNumbers: boolean;
  showCellNumbers: boolean;
  // Intentionally stage-independent: focused full address is a point-specific exception path.
  showFocusedFullAddress: true;
  rackCodeProminence: LabelProminence;
  rackCodePlacement: RackCodePlacement;
  faceTokenProminence: LabelProminence;
  sectionNumberProminence: LabelProminence;
  cellNumberProminence: LabelProminence;
};

const LOD1_STAGE_SPLIT_ZOOM = (LOD_SECTION_THRESHOLD + LOD_CELL_THRESHOLD) / 2;

export function resolveRackRevealStage(params: { lod: CanvasLOD; zoom: number }): RevealStage {
  const { lod, zoom } = params;
  if (lod <= 0) return 0;
  if (lod >= 2) return 3;
  return zoom < LOD1_STAGE_SPLIT_ZOOM ? 1 : 2;
}

export function getRackLabelRevealPolicy(params: { lod: CanvasLOD; zoom: number }): RackLabelRevealPolicy {
  const revealStage = resolveRackRevealStage(params);
  const showRackCode = true;
  const showFaceToken = revealStage >= 1;
  const showSectionNumbers = revealStage === 2;
  const showCellNumbers = revealStage >= 3;
  const rackCodeProminence =
    revealStage === 0 ? 'dominant' : revealStage === 1 ? 'secondary' : 'background';
  // Keep one stable shell anchor across all stages to avoid reveal-boundary jitter.
  const rackCodePlacement: RackCodePlacement = 'lower-left-mid';
  const faceTokenProminence =
    revealStage === 1 ? 'dominant' : revealStage === 2 ? 'secondary' : 'background';
  const sectionNumberProminence = revealStage === 2 ? 'dominant' : 'background';

  return {
    revealStage,
    showRackCode,
    showFaceToken,
    showSectionNumbers,
    showCellNumbers,
    showFocusedFullAddress: true,
    rackCodeProminence,
    rackCodePlacement,
    faceTokenProminence,
    sectionNumberProminence,
    cellNumberProminence: 'dominant'
  };
}

export function shouldShowFocusedFullAddress(params: {
  isSelected: boolean;
  isHighlighted: boolean;
  isWorkflowSource: boolean;
}): boolean {
  return params.isSelected || params.isHighlighted || params.isWorkflowSource;
}
