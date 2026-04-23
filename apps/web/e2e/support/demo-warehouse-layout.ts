import { createHash } from 'node:crypto';

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

type DemoRackStructureSpec = {
  sectionsPerFace: number;
  levelsPerSection: number;
  slotsPerLevel: number;
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

export const demoWarehouseStructureByRackId = {
  '01': { sectionsPerFace: 6, levelsPerSection: 3, slotsPerLevel: 3 },
  '02': { sectionsPerFace: 5, levelsPerSection: 3, slotsPerLevel: 3 },
  '03': { sectionsPerFace: 9, levelsPerSection: 3, slotsPerLevel: 3 },
  '04': { sectionsPerFace: 9, levelsPerSection: 3, slotsPerLevel: 3 },
  '05': { sectionsPerFace: 9, levelsPerSection: 3, slotsPerLevel: 3 },
  '06': { sectionsPerFace: 9, levelsPerSection: 3, slotsPerLevel: 3 },
  '07': { sectionsPerFace: 10, levelsPerSection: 3, slotsPerLevel: 3 },
  '08': { sectionsPerFace: 8, levelsPerSection: 3, slotsPerLevel: 3 },
  '09': { sectionsPerFace: 6, levelsPerSection: 2, slotsPerLevel: 3 },
  '10': { sectionsPerFace: 6, levelsPerSection: 2, slotsPerLevel: 3 }
} as const satisfies Record<string, DemoRackStructureSpec>;

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

export const demoWarehouseExpectedDraftRowCounts = {
  rackSections: Object.values(demoWarehouseStructureByRackId).reduce((sum, spec) => sum + spec.sectionsPerFace, 0),
  rackLevels: Object.values(demoWarehouseStructureByRackId).reduce(
    (sum, spec) => sum + spec.sectionsPerFace * spec.levelsPerSection,
    0
  ),
  cells: 0
} as const;

export const demoWarehouseExpectedPreviewCellCount = demoWarehouseVisualPlacements.reduce((sum, placement) => {
  const spec = demoWarehouseStructureByRackId[placement.rackId as keyof typeof demoWarehouseStructureByRackId];
  return sum + (spec.sectionsPerFace * spec.levelsPerSection * spec.slotsPerLevel * placement.faces);
}, 0);

function deterministicUuid(seed: string) {
  const hex = createHash('md5').update(seed).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function splitRackLength(totalLength: number, sectionCount: number) {
  const baseLength = Number((totalLength / sectionCount).toFixed(3));

  return Array.from({ length: sectionCount }, (_, index) =>
    index === sectionCount - 1
      ? Number((totalLength - baseLength * (sectionCount - 1)).toFixed(3))
      : baseLength
  );
}

function buildFaceSections(placement: DemoRackVisualPlacement): DraftRackSectionPayload[] {
  const spec = demoWarehouseStructureByRackId[placement.rackId as keyof typeof demoWarehouseStructureByRackId];
  const sectionLengths = splitRackLength(placement.length, spec.sectionsPerFace);

  return sectionLengths.map((length, sectionIndex) => {
    const sectionOrdinal = sectionIndex + 1;

    return {
      id: deterministicUuid(`demo-layout:${placement.rackId}:face:A:section:${sectionOrdinal}`),
      ordinal: sectionOrdinal,
      length,
      levels: Array.from({ length: spec.levelsPerSection }, (_, levelIndex) => {
        const levelOrdinal = levelIndex + 1;
        return {
          id: deterministicUuid(`demo-layout:${placement.rackId}:face:A:section:${sectionOrdinal}:level:${levelOrdinal}`),
          ordinal: levelOrdinal,
          slotCount: spec.slotsPerLevel
        };
      })
    };
  });
}

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
      sections: buildFaceSections(placement)
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
      // Repo-native mirrored Face B resolves structure from Face A.
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
