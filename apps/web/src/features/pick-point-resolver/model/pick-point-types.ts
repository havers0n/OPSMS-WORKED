export type PickPoint = {
  x: number;
  y: number;
  locationId: string;
  source:
    | 'non_rack_location'
    | 'rack_face_access'
    | 'rack_face_inferred';
  cellId?: string;
  rackId?: string;
  faceId?: string;
};

export type PickPointResolution =
  | { status: 'ok'; pickPoint: PickPoint }
  | { status: 'missing_location'; reason: string }
  | { status: 'missing_geometry'; reason: string }
  | { status: 'unsupported_location_type'; reason: string }
  | { status: 'ambiguous_face_access'; reason: string };

export type PickPointResolverConfig = {
  approachOffsetM?: number;
};

export type RackFaceSideLike = 'A' | 'B';
export type SlotNumberingDirectionLike = 'ltr' | 'rtl';

export type RackLevelLike = {
  id: string;
  ordinal?: number;
  slotCount: number;
};

export type RackSectionLike = {
  id: string;
  ordinal?: number;
  length: number;
  levels?: RackLevelLike[];
};

export type RackFaceLike = {
  id: string;
  side?: RackFaceSideLike;
  enabled?: boolean;
  slotNumberingDirection?: SlotNumberingDirectionLike;
  faceLength?: number;
  sections?: RackSectionLike[];
};

export type RackLike = {
  id: string;
  kind?: 'single' | 'paired' | string;
  x: number;
  y: number;
  totalLength: number;
  depth: number;
  rotationDeg: 0 | 90 | 180 | 270;
  faces?: RackFaceLike[];
};

export type CellLike = {
  id: string;
  rackId: string;
  rackFaceId: string;
  rackSectionId: string;
  rackLevelId: string;
  slotNo: number;
  faceSide?: RackFaceSideLike;
  side?: RackFaceSideLike;
};

export type FaceAccessLike = {
  faceId?: string;
  normalX?: number | null;
  normalY?: number | null;
};

export type PickPointResolverInput = {
  location: {
    id: string;
    locationType?: string;
    geometrySlotId?: string | null;
    cellId?: string | null;
    floorX?: number | null;
    floorY?: number | null;
  } | null;

  cellsById: Map<string, CellLike>;
  racksById: Map<string, RackLike>;
  facesById?: Map<string, RackFaceLike>;
  faceAccessByFaceId?: Map<string, FaceAccessLike>;

  config?: PickPointResolverConfig;
};

export type PointLike = {
  x: number;
  y: number;
};
