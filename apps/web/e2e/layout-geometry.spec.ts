import { expect, test } from '@playwright/test';
import { generatePreviewCells, type Rack } from '@wos/domain';
import { mapLayoutDraftBundleToDomain } from '../src/entities/layout-version/api/mappers';
import { WORLD_SCALE, getRackCanvasRect } from '../src/entities/layout-version/lib/canvas-geometry';
import {
  buildDemoWarehouseRackPayloads,
  demoWarehouseExpectedDraftRowCounts,
  demoWarehouseExpectedPreviewCellCount,
  demoWarehouseStructureByRackId,
  demoWarehouseVisualPlacements
} from './support/demo-warehouse-layout';
import {
  countFloorLocations,
  countLayoutRows,
  fetchLayoutDraftBundle,
  resetWarehouseData,
  seedExplicitDraftScenario
} from './support/local-supabase';

function toWorldRect(rack: Rack) {
  const rect = getRackCanvasRect(rack);
  return {
    x: rect.x / WORLD_SCALE,
    y: rect.y / WORLD_SCALE,
    width: rect.width / WORLD_SCALE,
    height: rect.height / WORLD_SCALE
  };
}

test.describe('layout geometry round-trip', () => {
  test.beforeEach(async () => {
    await resetWarehouseData();
  });

  test('verifies the vertical rack 08 stored origin round-trips to the agreed visual bounds', async () => {
    const rack08Payload = buildDemoWarehouseRackPayloads().find((rack) => rack.displayCode === '08');

    if (!rack08Payload) {
      throw new Error('Rack 08 payload is missing from the demo layout fixture.');
    }

    const { layoutVersionId } = await seedExplicitDraftScenario({
      siteCode: 'GEOM',
      siteName: 'Geometry Verification Site',
      floorCode: 'G08',
      floorName: 'Geometry Gate Floor',
      racks: [rack08Payload]
    });

    const bundle = await fetchLayoutDraftBundle(layoutVersionId);
    const draft = mapLayoutDraftBundleToDomain(bundle as Parameters<typeof mapLayoutDraftBundleToDomain>[0]);
    const rack = draft.racks[draft.rackIds[0] as string];

    expect(rack.displayCode).toBe('08');
    expect(rack.axis).toBe('NS');
    expect(rack.rotationDeg).toBe(90);
    expect(rack.x).toBeCloseTo(-12, 6);
    expect(rack.y).toBeCloseTo(12, 6);
    expect(rack.x).toBeCloseTo(rack08Payload.x, 6);
    expect(rack.y).toBeCloseTo(rack08Payload.y, 6);
    expect(rack.totalLength).toBeCloseTo(25, 6);
    expect(rack.depth).toBeCloseTo(1, 6);

    const worldRect = toWorldRect(rack);
    expect(worldRect.x).toBeCloseTo(0, 6);
    expect(worldRect.y).toBeCloseTo(0, 6);
    expect(worldRect.width).toBeCloseTo(1, 6);
    expect(worldRect.height).toBeCloseTo(25, 6);
  });

  test('round-trips the full 10-rack demo layout with layout-only rows and agreed visual bounds', async () => {
    const rackPayloads = buildDemoWarehouseRackPayloads();
    const { floor, layoutVersionId } = await seedExplicitDraftScenario({
      siteCode: 'DEMO_LAYOUT',
      siteName: 'Demo Layout Site',
      floorCode: 'DL1',
      floorName: 'Demo Layout Floor',
      racks: rackPayloads
    });

    const bundle = await fetchLayoutDraftBundle(layoutVersionId);
    const draft = mapLayoutDraftBundleToDomain(bundle as Parameters<typeof mapLayoutDraftBundleToDomain>[0]);
    const racksByCode = new Map(
      draft.rackIds.map((rackId) => {
        const rack = draft.racks[rackId];
        return [rack.displayCode, rack] as const;
      })
    );

    expect(draft.rackIds).toHaveLength(10);

    for (const placement of demoWarehouseVisualPlacements) {
      const rack = racksByCode.get(placement.rackId);
      expect(rack, `Missing rack ${placement.rackId}`).toBeDefined();
      if (!rack) {
        continue;
      }

      expect(rack.kind).toBe(placement.faces === 2 ? 'paired' : 'single');
      expect(rack.axis).toBe(placement.orientation === 'vertical' ? 'NS' : 'WE');
      expect(rack.rotationDeg).toBe(placement.orientation === 'vertical' ? 90 : 0);
      expect(rack.depth).toBeCloseTo(placement.width, 6);
      expect(rack.totalLength).toBeCloseTo(placement.length, 6);
      expect(rack.faces).toHaveLength(placement.faces);

      const faceA = rack.faces.find((face) => face.side === 'A');
      expect(faceA?.enabled).toBe(true);
      expect(faceA?.slotNumberingDirection).toBe('ltr');
      const structureSpec = demoWarehouseStructureByRackId[placement.rackId as keyof typeof demoWarehouseStructureByRackId];
      expect(faceA?.sections).toHaveLength(structureSpec.sectionsPerFace);
      expect(
        faceA?.sections.every(
          (section) =>
            section.levels.length === structureSpec.levelsPerSection &&
            section.levels.every((level) => level.slotCount === structureSpec.slotsPerLevel)
        )
      ).toBe(true);

      if (placement.faces === 2) {
        const faceB = rack.faces.find((face) => face.side === 'B');
        expect(faceB?.enabled).toBe(true);
        expect(faceB?.slotNumberingDirection).toBe('rtl');
        expect(faceB?.relationshipMode ?? (faceB?.isMirrored ? 'mirrored' : 'independent')).toBe('mirrored');
        expect(faceB?.mirrorSourceFaceId).toBe(faceA?.id ?? null);
        expect(faceB?.sections).toHaveLength(0);
      }

      const worldRect = toWorldRect(rack);
      const expectedWidth = placement.orientation === 'vertical' ? placement.width : placement.length;
      const expectedHeight = placement.orientation === 'vertical' ? placement.length : placement.width;

      expect(worldRect.x).toBeCloseTo(placement.visualX, 6);
      expect(worldRect.y).toBeCloseTo(placement.visualY, 6);
      expect(worldRect.width).toBeCloseTo(expectedWidth, 6);
      expect(worldRect.height).toBeCloseTo(expectedHeight, 6);
    }

    const previewCells = generatePreviewCells(draft);
    expect(previewCells).toHaveLength(demoWarehouseExpectedPreviewCellCount);
    expect(new Set(previewCells.map((cell) => cell.address.raw)).size).toBe(previewCells.length);

    const rowCounts = await countLayoutRows(layoutVersionId);
    expect(rowCounts.racks).toBe(10);
    expect(rowCounts.rackFaces).toBe(16);
    expect(rowCounts.rackSections).toBe(demoWarehouseExpectedDraftRowCounts.rackSections);
    expect(rowCounts.rackLevels).toBe(demoWarehouseExpectedDraftRowCounts.rackLevels);
    expect(rowCounts.cells).toBe(demoWarehouseExpectedDraftRowCounts.cells);
    expect(await countFloorLocations(floor.id)).toBe(0);
  });
});
