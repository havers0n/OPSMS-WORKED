export type DemoRackOrientation = 'vertical' | 'horizontal';

export type DemoRackVisualPlacement = {
  rackId: string;
  orientation: DemoRackOrientation;
  visualX: number;
  visualY: number;
  width: number;
  length: number;
  faces: 1 | 2;
};

export type DraftRackLevelPayload = {
  id: string;
  ordinal: number;
  slotCount: number;
  structuralDefaultRole?: 'primary_pick' | 'reserve' | 'none';
};

export type DraftRackSectionPayload = {
  id: string;
  ordinal: number;
  length: number;
  levels: DraftRackLevelPayload[];
};

export type DraftRackFacePayload = {
  id: string;
  side: 'A' | 'B';
  enabled: boolean;
  slotNumberingDirection: 'ltr' | 'rtl';
  relationshipMode: 'mirrored' | 'independent';
  isMirrored: boolean;
  mirrorSourceFaceId: string | null;
  faceLength?: number;
  sections: DraftRackSectionPayload[];
};

export type DraftRackPayload = {
  id: string;
  displayCode: string;
  kind: 'single' | 'paired';
  axis: 'NS' | 'WE';
  x: number;
  y: number;
  totalLength: number;
  depth: number;
  rotationDeg: 0 | 90 | 180 | 270;
  faces: DraftRackFacePayload[];
};

export const demoWarehouseVisualPlacements: DemoRackVisualPlacement[] = [
  { rackId: '08', orientation: 'vertical', visualX: 0.0, visualY: 0.0, width: 1.0, length: 25.0, faces: 1 },
  { rackId: '07', orientation: 'vertical', visualX: 4.7, visualY: 0.0, width: 2.3, length: 28.0, faces: 2 },
  { rackId: '06', orientation: 'vertical', visualX: 10.3, visualY: 0.0, width: 2.5, length: 26.0, faces: 2 },
  { rackId: '05', orientation: 'vertical', visualX: 16.0, visualY: 0.0, width: 2.5, length: 26.0, faces: 2 },
  { rackId: '04', orientation: 'vertical', visualX: 21.2, visualY: 0.0, width: 2.3, length: 25.2, faces: 2 },
  { rackId: '03', orientation: 'vertical', visualX: 26.05, visualY: 0.0, width: 2.2, length: 25.2, faces: 2 },
  { rackId: '02', orientation: 'vertical', visualX: 30.95, visualY: 0.0, width: 2.2, length: 14.0, faces: 2 },
  { rackId: '01', orientation: 'vertical', visualX: 35.85, visualY: 0.0, width: 1.0, length: 17.0, faces: 1 },
  { rackId: '09', orientation: 'horizontal', visualX: 16.0, visualY: 30.8, width: 2.25, length: 17.0, faces: 1 },
  { rackId: '10', orientation: 'horizontal', visualX: 16.0, visualY: 35.5, width: 1.0, length: 18.0, faces: 1 }
];

const demoRackPayloadIds = {
  '08': { rack: 'a64f2f0b-2b4f-4f8b-9e9b-080808080808', faceA: 'a64f2f0b-2b4f-4f8b-9e9b-08aa08aa08aa' },
  '07': {
    rack: 'a64f2f0b-2b4f-4f8b-9e9b-070707070707',
    faceA: 'a64f2f0b-2b4f-4f8b-9e9b-07aa07aa07aa',
    faceB: 'a64f2f0b-2b4f-4f8b-9e9b-07bb07bb07bb'
  },
  '06': {
    rack: 'a64f2f0b-2b4f-4f8b-9e9b-060606060606',
    faceA: 'a64f2f0b-2b4f-4f8b-9e9b-06aa06aa06aa',
    faceB: 'a64f2f0b-2b4f-4f8b-9e9b-06bb06bb06bb'
  },
  '05': {
    rack: 'a64f2f0b-2b4f-4f8b-9e9b-050505050505',
    faceA: 'a64f2f0b-2b4f-4f8b-9e9b-05aa05aa05aa',
    faceB: 'a64f2f0b-2b4f-4f8b-9e9b-05bb05bb05bb'
  },
  '04': {
    rack: 'a64f2f0b-2b4f-4f8b-9e9b-040404040404',
    faceA: 'a64f2f0b-2b4f-4f8b-9e9b-04aa04aa04aa',
    faceB: 'a64f2f0b-2b4f-4f8b-9e9b-04bb04bb04bb'
  },
  '03': {
    rack: 'a64f2f0b-2b4f-4f8b-9e9b-030303030303',
    faceA: 'a64f2f0b-2b4f-4f8b-9e9b-03aa03aa03aa',
    faceB: 'a64f2f0b-2b4f-4f8b-9e9b-03bb03bb03bb'
  },
  '02': {
    rack: 'a64f2f0b-2b4f-4f8b-9e9b-020202020202',
    faceA: 'a64f2f0b-2b4f-4f8b-9e9b-02aa02aa02aa',
    faceB: 'a64f2f0b-2b4f-4f8b-9e9b-02bb02bb02bb'
  },
  '01': { rack: 'a64f2f0b-2b4f-4f8b-9e9b-010101010101', faceA: 'a64f2f0b-2b4f-4f8b-9e9b-01aa01aa01aa' },
  '09': { rack: 'a64f2f0b-2b4f-4f8b-9e9b-090909090909', faceA: 'a64f2f0b-2b4f-4f8b-9e9b-09aa09aa09aa' },
  '10': { rack: 'a64f2f0b-2b4f-4f8b-9e9b-101010101010', faceA: 'a64f2f0b-2b4f-4f8b-9e9b-10aa10aa10aa' }
} as const;

// Verified by the geometry round-trip gate in layout-geometry.spec.ts:
// the repo stores vertical racks as the unrotated origin, then the renderer
// projects the visible bounds from a 90deg center rotation.
export function toStoredRackOrigin(placement: DemoRackVisualPlacement) {
  if (placement.orientation === 'horizontal') {
    return {
      x: placement.visualX,
      y: placement.visualY
    };
  }

  const halfDelta = (placement.length - placement.width) / 2;
  return {
    x: placement.visualX - halfDelta,
    y: placement.visualY + halfDelta
  };
}

function buildFacePayloads(placement: DemoRackVisualPlacement): DraftRackFacePayload[] {
  const ids = demoRackPayloadIds[placement.rackId as keyof typeof demoRackPayloadIds];
  const faces: DraftRackFacePayload[] = [
    {
      id: ids.faceA,
      side: 'A',
      enabled: true,
      slotNumberingDirection: 'ltr',
      relationshipMode: 'independent',
      isMirrored: false,
      mirrorSourceFaceId: null,
      sections: []
    }
  ];

  if (placement.faces === 2 && 'faceB' in ids) {
    faces.push({
      id: ids.faceB,
      side: 'B',
      enabled: true,
      slotNumberingDirection: 'rtl',
      relationshipMode: 'mirrored',
      isMirrored: true,
      mirrorSourceFaceId: ids.faceA,
      sections: []
    });
  }

  return faces;
}

export function buildDemoWarehouseRackPayloads(): DraftRackPayload[] {
  return demoWarehouseVisualPlacements.map((placement) => {
    const ids = demoRackPayloadIds[placement.rackId as keyof typeof demoRackPayloadIds];
    const storedOrigin = toStoredRackOrigin(placement);

    return {
      id: ids.rack,
      displayCode: placement.rackId,
      kind: placement.faces === 2 ? 'paired' : 'single',
      axis: placement.orientation === 'vertical' ? 'NS' : 'WE',
      x: storedOrigin.x,
      y: storedOrigin.y,
      totalLength: placement.length,
      depth: placement.width,
      rotationDeg: placement.orientation === 'vertical' ? 90 : 0,
      faces: buildFacePayloads(placement)
    };
  });
}
