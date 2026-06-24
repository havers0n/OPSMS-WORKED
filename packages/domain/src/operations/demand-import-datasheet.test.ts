import { describe, expect, it } from 'vitest';
import { buildRawDemandPlanningPreview, parseDemandImportDataSheetPreview } from './demand-import-datasheet';

function buildRow(overrides: Partial<Parameters<typeof parseDemandImportDataSheetPreview>[0]['rows'][number]> = {}) {
  return {
    sourceRowNumber: 2,
    agent: 'agent-a',
    orderDateRaw: '2026-06-24',
    customerName: 'לקוח א',
    orderNumber: 'SO-1',
    sku: 'SKU-1',
    description: 'מוצר רגיל',
    category: 'רגיל',
    quantity: 3,
    cost: 12.5,
    rawRouteLine: null,
    plannedDeliveryDateRaw: null,
    notes: null,
    distributionArea: 'דרום',
    ...overrides
  };
}

describe('demand import DataSheet parser', () => {
  it('stages normal rows as unplanned with null planned delivery fields', () => {
    const result = parseDemandImportDataSheetPreview({
      sourceFile: 'datasheet.xlsx',
      sourceSheet: 'DataSheet',
      rows: [buildRow()]
    });

    expect(result.rowsCount).toBe(1);
    expect(result.rawRowsCount).toBe(1);
    expect(result.warningRowsCount).toBe(0);
    expect(result.errorRowsCount).toBe(0);
    expect(result.specialFlowRowsCount).toBe(0);
    expect(result.rows[0]).toMatchObject({
      orderDate: '2026-06-24',
      distributionArea: 'דרום',
      planningStatus: 'unplanned',
      routeFlow: 'unassigned',
      plannedDeliveryDate: null,
      plannedRouteLine: null,
      plannedWorkBucket: null
    });
  });

  it('marks missing distribution area as error', () => {
    const result = parseDemandImportDataSheetPreview({
      sourceFile: 'datasheet.xlsx',
      sourceSheet: 'DataSheet',
      rows: [buildRow({ distributionArea: null })]
    });

    expect(result.errorRowsCount).toBe(1);
    expect(result.rows[0].planningStatus).toBe('error');
    expect(result.rows[0].issues).toContainEqual(expect.objectContaining({
      code: 'MISSING_DISTRIBUTION_AREA',
      severity: 'error'
    }));
  });

  it('marks missing SKU as error', () => {
    const result = parseDemandImportDataSheetPreview({
      sourceFile: 'datasheet.xlsx',
      sourceSheet: 'DataSheet',
      rows: [buildRow({ sku: null })]
    });

    expect(result.errorRowsCount).toBe(1);
    expect(result.rows[0].issues).toContainEqual(expect.objectContaining({
      code: 'MISSING_SKU',
      severity: 'error'
    }));
  });

  it('keeps zero quantity rows staged with warning', () => {
    const result = parseDemandImportDataSheetPreview({
      sourceFile: 'datasheet.xlsx',
      sourceSheet: 'DataSheet',
      rows: [buildRow({ quantity: 0 })]
    });

    expect(result.rawRowsCount).toBe(1);
    expect(result.warningRowsCount).toBe(1);
    expect(result.rows[0].planningStatus).toBe('unplanned');
    expect(result.rows[0].issues).toContainEqual(expect.objectContaining({
      code: 'ZERO_QUANTITY',
      severity: 'warning'
    }));
  });

  it('classifies pickup rows as special flow', () => {
    const result = parseDemandImportDataSheetPreview({
      sourceFile: 'datasheet.xlsx',
      sourceSheet: 'DataSheet',
      rows: [buildRow({ notes: 'איסוף עצמי מחר' })]
    });

    expect(result.specialFlowRowsCount).toBe(1);
    expect(result.rows[0]).toMatchObject({
      planningStatus: 'special_flow',
      routeFlow: 'pickup'
    });
  });

  it('classifies ashlama rows as special flow', () => {
    const result = parseDemandImportDataSheetPreview({
      sourceFile: 'datasheet.xlsx',
      sourceSheet: 'DataSheet',
      rows: [buildRow({ notes: 'השלמה דחופה' })]
    });

    expect(result.rows[0]).toMatchObject({
      planningStatus: 'special_flow',
      routeFlow: 'ashlama'
    });
  });

  it('classifies obvious handling flows', () => {
    const result = parseDemandImportDataSheetPreview({
      sourceFile: 'datasheet.xlsx',
      sourceSheet: 'DataSheet',
      rows: [
        buildRow({ sourceRowNumber: 2, description: 'סיגריות מנטה' }),
        buildRow({ sourceRowNumber: 3, description: 'בוסטר תוספת' }),
        buildRow({ sourceRowNumber: 4, description: 'צידנית קיץ' }),
        buildRow({ sourceRowNumber: 5, description: 'גריל פחמים' }),
        buildRow({ sourceRowNumber: 6, description: 'בריכה משפחתית' }),
        buildRow({ sourceRowNumber: 7, description: 'מיטה זוגית' }),
        buildRow({ sourceRowNumber: 8, description: 'כיסא פלסטיק' })
      ]
    });

    expect(result.rows.map((row) => row.productHandlingFlow)).toEqual([
      'cigarette',
      'booster',
      'cooler',
      'grill',
      'pool',
      'bed',
      'chair'
    ]);
  });

  it('extracts note date hints without affecting planning status', () => {
    const result = parseDemandImportDataSheetPreview({
      sourceFile: 'datasheet.xlsx',
      sourceSheet: 'DataSheet',
      rows: [buildRow({ notes: 'לתאם 25.06.26 מול לקוח' })]
    });

    expect(result.rows[0].planningStatus).toBe('unplanned');
    expect(result.rows[0].noteDateHints).toEqual([
      { raw: '25.06.26', normalized: '2026-06-25' }
    ]);
    expect(result.rows[0].plannedDeliveryDate).toBeNull();
  });
});

describe('raw demand planning preview builder', () => {
  const batch = {
    id: '70000000-0000-4000-8000-000000000001',
    tenantId: '11111111-1111-4111-8111-111111111111',
    sourceFile: 'datasheet.xlsx',
    sourceSheet: 'DataSheet' as const,
    uploadedAt: '2026-06-24T08:00:00.000Z',
    uploadedBy: '22222222-2222-4222-8222-222222222222',
    status: 'ready' as const,
    rowsCount: 5,
    rawRowsCount: 3,
    warningRowsCount: 1,
    errorRowsCount: 1,
    specialFlowRowsCount: 1,
    distributionAreasCount: 2,
    distinctOrdersCount: 4,
    distinctSkuCount: 4
  };

  function buildPersistedRow(
    overrides: Partial<ReturnType<typeof parseDemandImportDataSheetPreview>['rows'][number]> = {}
  ) {
    return {
      id: `71000000-0000-4000-8000-${String(overrides.sourceRowNumber ?? 2).padStart(12, '0')}`,
      tenantId: batch.tenantId,
      batchId: batch.id,
      createdAt: '2026-06-24T08:05:00.000Z',
      ...parseDemandImportDataSheetPreview({
        sourceFile: 'datasheet.xlsx',
        sourceSheet: 'DataSheet',
        rows: [buildRow(overrides as never)]
      }).rows[0],
      ...overrides
    };
  }

  it('groups normal rows by distribution area and collapses same order into one order summary', () => {
    const result = buildRawDemandPlanningPreview({
      batch,
      rows: [
        buildPersistedRow({ sourceRowNumber: 2, distributionArea: 'דרום', orderNumber: 'SO-1', customerName: 'לקוח א', sku: 'SKU-1', quantity: 3 }),
        buildPersistedRow({ sourceRowNumber: 3, distributionArea: 'דרום', orderNumber: 'SO-1', customerName: 'לקוח א', sku: 'SKU-2', quantity: 4 }),
        buildPersistedRow({ sourceRowNumber: 4, distributionArea: 'צפון', orderNumber: 'SO-2', customerName: 'לקוח ב', sku: 'SKU-3', quantity: 2 })
      ]
    });

    expect(result.summary).toMatchObject({
      rowsCount: 3,
      normalRowsCount: 3,
      distributionAreasCount: 2,
      ordersCount: 2,
      skuCount: 3,
      totalQuantity: 9
    });
    expect(result.distributionAreas[0]).toMatchObject({
      distributionArea: 'דרום',
      rowsCount: 2,
      ordersCount: 1,
      skuCount: 2,
      totalQuantity: 7
    });
    expect(result.distributionAreas[0].orders).toEqual([
      expect.objectContaining({
        orderNumber: 'SO-1',
        customerName: 'לקוח א',
        rowsCount: 2,
        skuCount: 2,
        totalQuantity: 7
      })
    ]);
  });

  it('aggregates product quantity by sku within an area', () => {
    const result = buildRawDemandPlanningPreview({
      batch,
      rows: [
        buildPersistedRow({ sourceRowNumber: 2, distributionArea: 'דרום', orderNumber: 'SO-1', customerName: 'לקוח א', sku: 'SKU-1', quantity: 3 }),
        buildPersistedRow({ sourceRowNumber: 3, distributionArea: 'דרום', orderNumber: 'SO-2', customerName: 'לקוח ב', sku: 'SKU-1', quantity: 5 })
      ]
    });

    expect(result.distributionAreas[0].productSummary).toEqual([
      expect.objectContaining({
        sku: 'SKU-1',
        totalQuantity: 8,
        orderCount: 2
      })
    ]);
  });

  it('keeps special-flow rows outside normal totals and exposes them separately', () => {
    const result = buildRawDemandPlanningPreview({
      batch,
      rows: [
        buildPersistedRow({ sourceRowNumber: 2, distributionArea: 'דרום', orderNumber: 'SO-1', customerName: 'לקוח א', sku: 'SKU-1', quantity: 3 }),
        buildPersistedRow({ sourceRowNumber: 3, distributionArea: 'דרום', orderNumber: 'SO-9', customerName: 'לקוח ט', sku: 'SKU-9', quantity: 7, planningStatus: 'special_flow', routeFlow: 'pickup', issues: [] })
      ]
    });

    expect(result.summary).toMatchObject({
      rowsCount: 2,
      normalRowsCount: 1,
      specialFlowRowsCount: 1,
      totalQuantity: 3
    });
    expect(result.distributionAreas[0]).toMatchObject({
      rowsCount: 2,
      ordersCount: 1,
      totalQuantity: 3,
      specialFlowRowsCount: 1
    });
    expect(result.specialFlows).toEqual([
      expect.objectContaining({
        routeFlow: 'pickup',
        rowsCount: 1,
        ordersCount: 1,
        totalQuantity: 7
      })
    ]);
  });

  it('includes order.items[] with rawDemandRowId in planning preview', () => {
    const result = buildRawDemandPlanningPreview({
      batch,
      rows: [
        buildPersistedRow({ sourceRowNumber: 2, distributionArea: 'דרום', orderNumber: 'SO-1', customerName: 'לקוח א', sku: 'SKU-1', quantity: 3, productHandlingFlow: 'regular', planningStatus: 'unplanned', issues: [] }),
        buildPersistedRow({ sourceRowNumber: 3, distributionArea: 'דרום', orderNumber: 'SO-1', customerName: 'לקוח א', sku: 'SKU-2', quantity: 4, productHandlingFlow: 'cigarette', planningStatus: 'unplanned', issues: [{ severity: 'warning', code: 'LOW_STOCK', message: 'low stock' }] })
      ]
    });

    const area = result.distributionAreas[0];
    expect(area.orders).toHaveLength(1);

    const order = area.orders[0];
    expect(order.items).toHaveLength(2);

    expect(order.items[0]).toMatchObject({
      rawDemandRowId: expect.stringMatching(/^71000000-0000-4000-8000-/),
      sku: 'SKU-1',
      quantity: 3,
      productHandlingFlow: 'regular',
      planningStatus: 'unplanned',
      issues: []
    });

    expect(order.items[1]).toMatchObject({
      rawDemandRowId: expect.stringMatching(/^71000000-0000-4000-8000-/),
      sku: 'SKU-2',
      quantity: 4,
      productHandlingFlow: 'cigarette',
      planningStatus: 'unplanned',
      issues: [{ severity: 'warning', code: 'LOW_STOCK', message: 'low stock' }]
    });
  });

  it('multi-line same order produces one order with multiple items', () => {
    const result = buildRawDemandPlanningPreview({
      batch,
      rows: [
        buildPersistedRow({ sourceRowNumber: 2, distributionArea: 'דרום', orderNumber: 'SO-1', customerName: 'לקוח א', sku: 'SKU-1', quantity: 3 }),
        buildPersistedRow({ sourceRowNumber: 3, distributionArea: 'דרום', orderNumber: 'SO-1', customerName: 'לקוח א', sku: 'SKU-2', quantity: 4 }),
        buildPersistedRow({ sourceRowNumber: 4, distributionArea: 'דרום', orderNumber: 'SO-1', customerName: 'לקוח א', sku: 'SKU-3', quantity: 5 })
      ]
    });

    const orders = result.distributionAreas[0].orders;
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({
      orderNumber: 'SO-1',
      rowsCount: 3,
      skuCount: 3,
      totalQuantity: 12
    });
    expect(orders[0].items).toHaveLength(3);
    expect(orders[0].items.map((i) => i.sku)).toEqual(['SKU-1', 'SKU-2', 'SKU-3']);
    expect(orders[0].items.map((i) => i.quantity)).toEqual([3, 4, 5]);
  });

  it('special_flow rows are not included in normal order items', () => {
    const result = buildRawDemandPlanningPreview({
      batch,
      rows: [
        buildPersistedRow({ sourceRowNumber: 2, distributionArea: 'דרום', orderNumber: 'SO-1', customerName: 'לקוח א', sku: 'SKU-1', quantity: 3 }),
        buildPersistedRow({ sourceRowNumber: 3, distributionArea: 'דרום', orderNumber: 'SO-1', customerName: 'לקוח א', sku: 'SKU-2', quantity: 4, planningStatus: 'special_flow', routeFlow: 'pickup', issues: [] })
      ]
    });

    const orders = result.distributionAreas[0].orders;
    expect(orders).toHaveLength(1);
    // Only the normal row should produce an order with items
    expect(orders[0].items).toHaveLength(1);
    expect(orders[0].items[0]).toMatchObject({ sku: 'SKU-1', quantity: 3 });
    // Special flow should not contribute to normal order items
    expect(result.specialFlows[0]).toMatchObject({ routeFlow: 'pickup', rowsCount: 1 });
  });

  it('keeps error rows outside normal totals and exposes them separately', () => {
    const result = buildRawDemandPlanningPreview({
      batch,
      rows: [
        buildPersistedRow({ sourceRowNumber: 2, distributionArea: 'דרום', orderNumber: 'SO-1', customerName: 'לקוח א', sku: 'SKU-1', quantity: 3 }),
        buildPersistedRow({
          sourceRowNumber: 3,
          distributionArea: 'דרום',
          orderNumber: 'SO-2',
          customerName: 'לקוח ב',
          sku: null,
          quantity: 4,
          planningStatus: 'error',
          issues: [{ severity: 'error', code: 'MISSING_SKU', message: 'missing sku', field: 'sku' }]
        })
      ]
    });

    expect(result.summary).toMatchObject({
      rowsCount: 2,
      normalRowsCount: 1,
      errorRowsCount: 1,
      totalQuantity: 3
    });
    expect(result.distributionAreas[0]).toMatchObject({
      rowsCount: 2,
      ordersCount: 1,
      totalQuantity: 3,
      errorRowsCount: 1
    });
    expect(result.errors).toEqual([
      expect.objectContaining({
        sourceRowNumber: 3,
        orderNumber: 'SO-2',
        customerName: 'לקוח ב',
        distributionArea: 'דרום'
      })
    ]);
  });
});
