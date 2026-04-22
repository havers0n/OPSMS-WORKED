import {
  buildCellAddress,
  buildCellStructureKey,
  type Cell,
  type LocationStorageSnapshotRow,
  type OperationsCellRuntime,
  type Product,
  type Rack,
  type RackFace,
  type RackLevel,
  type RackSection
} from '@wos/domain';
import { getRackGeometry } from '@/entities/layout-version/lib/canvas-geometry';

function makeLevel(
  id: string,
  ordinal: number,
  slotCount: number,
  structuralDefaultRole?: 'primary_pick' | 'reserve' | 'none'
): RackLevel {
  return {
    id,
    ordinal,
    slotCount,
    structuralDefaultRole
  };
}

function makeSection(id: string, ordinal: number, length: number, levels: RackLevel[]): RackSection {
  return {
    id,
    ordinal,
    length,
    levels
  };
}

function makeFace({
  id,
  side,
  slotNumberingDirection = 'ltr',
  sections,
  relationshipMode,
  faceLength
}: {
  id: string;
  side: 'A' | 'B';
  slotNumberingDirection?: 'ltr' | 'rtl';
  sections: RackSection[];
  relationshipMode?: 'mirrored' | 'independent';
  faceLength?: number;
}): RackFace {
  return {
    id,
    side,
    enabled: true,
    slotNumberingDirection,
    relationshipMode,
    isMirrored: relationshipMode === 'mirrored',
    mirrorSourceFaceId: relationshipMode === 'mirrored' ? 'face-a' : null,
    faceLength,
    sections
  };
}

function makeRack({
  id,
  displayCode,
  kind,
  faces,
  totalLength = 4.8,
  depth = 2.4,
  rotationDeg = 0
}: {
  id: string;
  displayCode: string;
  kind: 'single' | 'paired';
  faces: RackFace[];
  totalLength?: number;
  depth?: number;
  rotationDeg?: 0 | 90 | 180 | 270;
}): Rack {
  return {
    id,
    displayCode,
    kind,
    axis: 'WE',
    faces,
    x: 0,
    y: 0,
    totalLength,
    depth,
    rotationDeg
  };
}

function makeCell({
  id,
  rackId,
  rackFaceId,
  rackSectionId,
  rackLevelId,
  slotNo,
  rackCode,
  face,
  section,
  level
}: {
  id: string;
  rackId: string;
  rackFaceId: string;
  rackSectionId: string;
  rackLevelId: string;
  slotNo: number;
  rackCode: string;
  face: 'A' | 'B';
  section: number;
  level: number;
}): Cell {
  return {
    id,
    cellCode: `cell-code-${id}`,
    layoutVersionId: 'layout-version-story',
    rackId,
    rackFaceId,
    rackSectionId,
    rackLevelId,
    slotNo,
    address: buildCellAddress({ rackCode, face, section, level, slot: slotNo }),
    status: 'active'
  };
}

function makeRuntime(cellId: string, cellAddress: string, status: OperationsCellRuntime['status']) {
  return {
    cellId,
    cellAddress,
    status,
    pickActive: status === 'pick_active',
    reserved: status === 'reserved',
    quarantined: status === 'quarantined',
    stocked: status === 'stocked',
    containerCount: 1,
    totalQuantity: 8,
    containers: []
  } satisfies OperationsCellRuntime;
}

function makeRuntimeMap(
  entries: Array<[cellId: string, cellAddress: string, status: OperationsCellRuntime['status']]>
) {
  return new Map<string, OperationsCellRuntime>(
    entries.map(([cellId, cellAddress, status]) => [cellId, makeRuntime(cellId, cellAddress, status)])
  );
}

function makeProduct(id: string, sku: string, name: string): Product {
  return {
    id,
    source: 'storybook',
    externalProductId: sku,
    sku,
    name,
    permalink: null,
    imageUrls: [],
    imageFiles: [],
    isActive: true,
    createdAt: '2026-04-01T08:00:00.000Z',
    updatedAt: '2026-04-01T08:00:00.000Z'
  };
}

function makeStorageRow({
  containerId,
  systemCode,
  externalCode,
  containerType,
  containerStatus,
  locationCode,
  product,
  quantity,
  uom,
  itemRef
}: {
  containerId: string;
  systemCode: string;
  externalCode: string | null;
  containerType: string;
  containerStatus: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
  locationCode: string;
  product: Product | null;
  quantity: number | null;
  uom: string | null;
  itemRef: string | null;
}): LocationStorageSnapshotRow {
  return {
    tenantId: '11111111-1111-4111-8111-111111111111',
    floorId: '22222222-2222-4222-8222-222222222222',
    locationId: '33333333-3333-4333-8333-333333333333',
    locationCode,
    locationType: 'rack_slot',
    cellId: '44444444-4444-4444-8444-444444444444',
    containerId,
    systemCode,
    externalCode,
    containerType,
    containerStatus,
    placedAt: '2026-04-01T09:30:00.000Z',
    itemRef,
    product,
    quantity,
    uom,
    packagingState: null,
    productPackagingLevelId: null,
    packCount: null
  };
}

const faceALevels = [
  makeLevel('level-a-3', 3, 4, 'reserve'),
  makeLevel('level-a-2', 2, 4, 'primary_pick'),
  makeLevel('level-a-1', 1, 4, 'primary_pick')
];

const faceBLevels = [
  makeLevel('level-b-3', 3, 4, 'reserve'),
  makeLevel('level-b-2', 2, 4, 'reserve'),
  makeLevel('level-b-1', 1, 4, 'none')
];

const faceA = makeFace({
  id: 'face-a',
  side: 'A',
  sections: [
    makeSection('section-a-1', 1, 2.2, faceALevels),
    makeSection('section-a-2', 2, 2.6, faceALevels)
  ],
  faceLength: 4.8
});

const faceB = makeFace({
  id: 'face-b',
  side: 'B',
  sections: [
    makeSection('section-b-1', 1, 2.0, faceBLevels),
    makeSection('section-b-2', 2, 2.0, faceBLevels)
  ],
  relationshipMode: 'independent',
  faceLength: 4
});

export const singleRackStory = makeRack({
  id: 'rack-single-story',
  displayCode: 'R-01',
  kind: 'single',
  faces: [faceA]
});

export const pairedRackStory = makeRack({
  id: 'rack-paired-story',
  displayCode: 'R-14',
  kind: 'paired',
  faces: [faceA, faceB]
});

export const singleRackGeometryStory = getRackGeometry(singleRackStory);
export const pairedRackGeometryStory = getRackGeometry(pairedRackStory);

export const faceAStory = faceA;
export const faceBStory = faceB;

const publishedCells = [
  makeCell({
    id: 'cell-a-2-1',
    rackId: pairedRackStory.id,
    rackFaceId: faceA.id,
    rackSectionId: 'section-a-1',
    rackLevelId: 'level-a-2',
    slotNo: 1,
    rackCode: pairedRackStory.displayCode,
    face: 'A',
    section: 1,
    level: 2
  }),
  makeCell({
    id: 'cell-a-2-2',
    rackId: pairedRackStory.id,
    rackFaceId: faceA.id,
    rackSectionId: 'section-a-1',
    rackLevelId: 'level-a-2',
    slotNo: 2,
    rackCode: pairedRackStory.displayCode,
    face: 'A',
    section: 1,
    level: 2
  }),
  makeCell({
    id: 'cell-a-2-3',
    rackId: pairedRackStory.id,
    rackFaceId: faceA.id,
    rackSectionId: 'section-a-1',
    rackLevelId: 'level-a-2',
    slotNo: 3,
    rackCode: pairedRackStory.displayCode,
    face: 'A',
    section: 1,
    level: 2
  }),
  makeCell({
    id: 'cell-a-2-4',
    rackId: pairedRackStory.id,
    rackFaceId: faceA.id,
    rackSectionId: 'section-a-1',
    rackLevelId: 'level-a-2',
    slotNo: 4,
    rackCode: pairedRackStory.displayCode,
    face: 'A',
    section: 1,
    level: 2
  }),
  makeCell({
    id: 'cell-a-2b-1',
    rackId: pairedRackStory.id,
    rackFaceId: faceA.id,
    rackSectionId: 'section-a-2',
    rackLevelId: 'level-a-2',
    slotNo: 1,
    rackCode: pairedRackStory.displayCode,
    face: 'A',
    section: 2,
    level: 2
  }),
  makeCell({
    id: 'cell-a-2b-2',
    rackId: pairedRackStory.id,
    rackFaceId: faceA.id,
    rackSectionId: 'section-a-2',
    rackLevelId: 'level-a-2',
    slotNo: 2,
    rackCode: pairedRackStory.displayCode,
    face: 'A',
    section: 2,
    level: 2
  }),
  makeCell({
    id: 'cell-b-1-1',
    rackId: pairedRackStory.id,
    rackFaceId: faceB.id,
    rackSectionId: 'section-b-1',
    rackLevelId: 'level-b-1',
    slotNo: 1,
    rackCode: pairedRackStory.displayCode,
    face: 'B',
    section: 1,
    level: 1
  }),
  makeCell({
    id: 'cell-b-1-2',
    rackId: pairedRackStory.id,
    rackFaceId: faceB.id,
    rackSectionId: 'section-b-1',
    rackLevelId: 'level-b-1',
    slotNo: 2,
    rackCode: pairedRackStory.displayCode,
    face: 'B',
    section: 1,
    level: 1
  })
];

export const publishedCellsByStructureStory = new Map(
  publishedCells.map((cell) => [buildCellStructureKey(cell), cell])
);

export const layoutOnlyPublishedCellsByStructureStory = new Map<string, Cell>();
export const canonicalEmptyOccupiedCellIdsStory = new Set<string>();
export const canonicalEmptyCellRuntimeByIdStory = new Map<string, OperationsCellRuntime>();

export const canonicalOccupiedCellIdsStory = new Set<string>(['cell-a-2-2']);
export const canonicalOccupiedCellRuntimeByIdStory = makeRuntimeMap([
  ['cell-a-2-2', 'R-14-A.01.02.02', 'stocked']
]);

export const canonicalStorageVariantCellRuntimeByIdStory = makeRuntimeMap([
  ['cell-a-2-2', 'R-14-A.01.02.02', 'stocked'],
  ['cell-a-2-3', 'R-14-A.01.02.03', 'reserved'],
  ['cell-a-2-4', 'R-14-A.01.02.04', 'pick_active'],
  ['cell-b-1-1', 'R-14-B.01.01.01', 'quarantined']
]);

export const canonicalStorageVariantOccupiedCellIdsStory = new Set<string>([
  'cell-a-2-2',
  'cell-a-2-3',
  'cell-a-2-4',
  'cell-b-1-1'
]);

export const canonicalReservedCellIdStory = 'cell-a-2-3';
export const canonicalReservedCellRuntimeByIdStory = makeRuntimeMap([
  [canonicalReservedCellIdStory, 'R-14-A.01.02.03', 'reserved']
]);
export const canonicalReservedOccupiedCellIdsStory = new Set<string>([canonicalReservedCellIdStory]);

export const canonicalSelectedCellIdStory = 'cell-a-2-2';
export const canonicalLocateTargetCellIdStory = 'cell-a-2-3';
export const canonicalWorkflowSourceCellIdStory = 'cell-a-2-2';
export const canonicalSearchHitCellIdsStory = new Set<string>(['cell-a-2-4']);
export const canonicalSearchHitAndLocateCellIdsStory = new Set<string>([
  'cell-a-2-3',
  'cell-a-2-4',
  'cell-a-2b-2'
]);

export const degradedOccupiedCellIdsStory = new Set<string>(['cell-a-2-2']);
export const degradedOccupiedCellRuntimeByIdStory = new Map<string, OperationsCellRuntime>();
export const unknownTruthCellRuntimeByIdStory = new Map<string, OperationsCellRuntime>();
export const unknownTruthOccupiedCellIdsStory = new Set<string>();

const productBlue = makeProduct(
  '55555555-5555-4555-8555-555555555555',
  'SKU-BLUE-01',
  'Blue totes'
);
const productAmber = makeProduct(
  '66666666-6666-4666-8666-666666666666',
  'SKU-AMBER-08',
  'Amber fasteners'
);

export const containerStorageRowsStory = [
  makeStorageRow({
    containerId: '77777777-7777-4777-8777-777777777777',
    systemCode: 'CNT-00192',
    externalCode: 'PAL-A19',
    containerType: 'pallet',
    containerStatus: 'active',
    locationCode: 'R-14-A.01.02.02',
    product: productBlue,
    quantity: 12,
    uom: 'pcs',
    itemRef: 'ITEM-BLUE-01'
  }),
  makeStorageRow({
    containerId: '77777777-7777-4777-8777-777777777777',
    systemCode: 'CNT-00192',
    externalCode: 'PAL-A19',
    containerType: 'pallet',
    containerStatus: 'active',
    locationCode: 'R-14-A.01.02.02',
    product: productAmber,
    quantity: 6,
    uom: 'boxes',
    itemRef: 'ITEM-AMBER-08'
  }),
  makeStorageRow({
    containerId: '88888888-8888-4888-8888-888888888888',
    systemCode: 'CNT-00911',
    externalCode: null,
    containerType: 'bin',
    containerStatus: 'quarantined',
    locationCode: 'R-14-A.01.02.02',
    product: null,
    quantity: null,
    uom: null,
    itemRef: null
  })
];

export const groupedContainersStory = [
  {
    containerId: '77777777-7777-4777-8777-777777777777',
    rows: containerStorageRowsStory.slice(0, 2)
  },
  {
    containerId: '88888888-8888-4888-8888-888888888888',
    rows: containerStorageRowsStory.slice(2)
  }
];

export const inventoryPreviewRowsStory = containerStorageRowsStory.slice(0, 2);
export const selectedProductStory = productBlue;

export const rackOverviewSummaryStory = {
  displayCode: 'R-14',
  kind: 'paired',
  axis: 'WE',
  occupancySummary: {
    occupancyRate: 0.38,
    occupiedCells: 6,
    totalCells: 16
  },
  levels: [
    { levelOrdinal: 3, occupiedCells: 1, totalCells: 4 },
    { levelOrdinal: 2, occupiedCells: 3, totalCells: 4 },
    { levelOrdinal: 1, occupiedCells: 2, totalCells: 8 }
  ]
};

export const rackOverviewFocusedSummaryStory = {
  displayCode: 'R-03',
  kind: 'single',
  axis: 'NS',
  occupancySummary: {
    occupancyRate: 0.5,
    occupiedCells: 4,
    totalCells: 8
  },
  levels: [
    { levelOrdinal: 3, occupiedCells: 0, totalCells: 2 },
    { levelOrdinal: 2, occupiedCells: 1, totalCells: 2 },
    { levelOrdinal: 1, occupiedCells: 3, totalCells: 4 }
  ]
};

export const rackOverviewWarningSummaryStory = {
  displayCode: 'R-22',
  kind: 'paired',
  axis: 'WE',
  occupancySummary: {
    occupancyRate: 0.94,
    occupiedCells: 15,
    totalCells: 16
  },
  levels: [
    { levelOrdinal: 4, occupiedCells: 4, totalCells: 4 },
    { levelOrdinal: 3, occupiedCells: 4, totalCells: 4 },
    { levelOrdinal: 2, occupiedCells: 3, totalCells: 4 },
    { levelOrdinal: 1, occupiedCells: 4, totalCells: 4 }
  ]
};

export const locationContainerCardsStory = [
  {
    containerId: '77777777-7777-4777-8777-777777777777',
    title: 'PAL-A19',
    secondaryText: 'External code PAL-A19 | pallet | Apr 1, 2026, 9:30 AM',
    status: 'active',
    inventoryEntryCount: 2
  },
  {
    containerId: '88888888-8888-4888-8888-888888888888',
    title: 'CNT-00911',
    secondaryText: 'Internal only | bin | Apr 1, 2026, 9:30 AM',
    status: 'quarantined',
    inventoryEntryCount: 0
  }
];

export const locationInventoryItemsStory = [
  {
    key: 'ITEM-BLUE-01',
    imageUrl: null,
    title: 'Blue totes',
    meta: 'SKU-BLUE-01',
    totalQuantity: 12,
    uom: 'pcs',
    containerCount: 1
  },
  {
    key: 'ITEM-AMBER-08',
    imageUrl: null,
    title: 'Amber fasteners',
    meta: 'SKU-AMBER-08',
    totalQuantity: 6,
    uom: 'boxes',
    containerCount: 1
  }
];

export const locationPolicyAssignmentsStory = [
  {
    id: 'policy-1',
    productName: 'Blue totes',
    productSku: 'SKU-BLUE-01',
    role: 'primary_pick'
  },
  {
    id: 'policy-2',
    productName: 'Amber fasteners',
    productSku: 'SKU-AMBER-08',
    role: 'reserve'
  }
];

export const canonicalOccupiedPanelContextStory = {
  selectedCellId: canonicalSelectedCellIdStory,
  containers: locationContainerCardsStory.slice(0, 1),
  inventoryItems: locationInventoryItemsStory.slice(0, 1),
  hasContainers: true,
  policyAssignments: locationPolicyAssignmentsStory.slice(0, 1),
  policyPending: false
};

export const canonicalEmptyPanelContextStory = {
  selectedCellId: 'cell-a-2-1',
  containers: [],
  inventoryItems: [],
  hasContainers: false,
  policyAssignments: [],
  policyPending: false
};

export const canonicalPolicyOnlyPanelContextStory = {
  selectedCellId: canonicalSelectedCellIdStory,
  containers: [],
  inventoryItems: [],
  hasContainers: false,
  policyAssignments: locationPolicyAssignmentsStory,
  policyPending: false
};
