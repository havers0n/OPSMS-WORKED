import { describe, expect, it } from 'vitest';
import type { RawDemandPlanningPreview } from '@wos/domain';
import { adaptDemandPlanningPreviewToSource, buildDemandOrderId } from './demand-source-adapter';

const BATCH_ID = 'b0000000-0000-4000-8000-000000000001';

function makePreview(overrides?: Partial<RawDemandPlanningPreview>): RawDemandPlanningPreview {
  return {
    batch: {
      id: BATCH_ID,
      sourceFile: 'datasheet.xlsx',
      sourceSheet: 'DataSheet',
      uploadedAt: '2026-06-24T12:00:00.000Z',
      status: 'ready',
      rowsCount: 5,
      rawRowsCount: 4,
      warningRowsCount: 0,
      errorRowsCount: 1,
      specialFlowRowsCount: 1,
      distributionAreasCount: 1,
      distinctOrdersCount: 2,
      distinctSkuCount: 3,
    },
    summary: {
      rowsCount: 5,
      normalRowsCount: 3,
      specialFlowRowsCount: 1,
      errorRowsCount: 1,
      distributionAreasCount: 1,
      ordersCount: 2,
      skuCount: 3,
      totalQuantity: 50,
    },
    distributionAreas: [
      {
        distributionArea: 'דרום',
        rowsCount: 5,
        ordersCount: 2,
        skuCount: 3,
        totalQuantity: 50,
        specialFlowRowsCount: 1,
        errorRowsCount: 1,
        orders: [
          {
            orderNumber: 'SO-001',
            customerName: 'לקוח א',
            rowsCount: 2,
            skuCount: 2,
            totalQuantity: 30,
            productHandlingFlows: ['regular'],
            issues: [],
            items: [
              {
                rawDemandRowId: 'r1000000-0000-4000-8000-000000000001',
                sku: 'SKU-001',
                description: 'מוצר 1',
                category: 'כללי',
                quantity: 10,
                productHandlingFlow: 'regular',
                planningStatus: 'unplanned',
                issues: [],
              },
              {
                rawDemandRowId: 'r1000000-0000-4000-8000-000000000002',
                sku: 'SKU-002',
                description: 'מוצר 2',
                category: 'מיוחד',
                quantity: 20,
                productHandlingFlow: 'cigarette',
                planningStatus: 'unplanned',
                issues: [],
              },
            ],
          },
          {
            orderNumber: 'SO-002',
            customerName: 'לקוח ב',
            rowsCount: 1,
            skuCount: 1,
            totalQuantity: 20,
            productHandlingFlows: ['regular'],
            issues: [],
            items: [
              {
                rawDemandRowId: 'r1000000-0000-4000-8000-000000000003',
                sku: 'SKU-003',
                description: 'מוצר 3',
                category: 'כללי',
                quantity: 20,
                productHandlingFlow: 'regular',
                planningStatus: 'unplanned',
                issues: [],
              },
            ],
          },
        ],
        productSummary: [],
        issues: [],
      },
    ],
    specialFlows: [],
    errors: [],
    ...overrides,
  } as RawDemandPlanningPreview;
}

function makePreviewWithSpecialAndError(): RawDemandPlanningPreview {
  return {
    batch: {
      id: BATCH_ID,
      sourceFile: 'datasheet.xlsx',
      sourceSheet: 'DataSheet',
      uploadedAt: '2026-06-24T12:00:00.000Z',
      status: 'ready',
      rowsCount: 6,
      rawRowsCount: 4,
      warningRowsCount: 0,
      errorRowsCount: 1,
      specialFlowRowsCount: 1,
      distributionAreasCount: 1,
      distinctOrdersCount: 1,
      distinctSkuCount: 4,
    },
    summary: {
      rowsCount: 6,
      normalRowsCount: 3,
      specialFlowRowsCount: 1,
      errorRowsCount: 1,
      distributionAreasCount: 1,
      ordersCount: 1,
      skuCount: 4,
      totalQuantity: 60,
    },
    distributionAreas: [
      {
        distributionArea: 'צפון',
        rowsCount: 6,
        ordersCount: 1,
        skuCount: 4,
        totalQuantity: 60,
        specialFlowRowsCount: 1,
        errorRowsCount: 1,
        orders: [
          {
            orderNumber: 'SO-003',
            customerName: 'לקוח ג',
            rowsCount: 4,
            skuCount: 4,
            totalQuantity: 60,
            productHandlingFlows: ['regular', 'pickup'],
            issues: [],
            items: [
              {
                rawDemandRowId: 'r2000000-0000-4000-8000-000000000001',
                sku: 'SKU-010',
                description: 'רגיל',
                category: 'כללי',
                quantity: 10,
                productHandlingFlow: 'regular',
                planningStatus: 'unplanned',
                issues: [],
              },
              {
                rawDemandRowId: 'r2000000-0000-4000-8000-000000000002',
                sku: 'SKU-011',
                description: 'רגיל 2',
                category: 'כללי',
                quantity: 15,
                productHandlingFlow: 'regular',
                planningStatus: 'unplanned',
                issues: [],
              },
              {
                rawDemandRowId: 'r2000000-0000-4000-8000-000000000003',
                sku: 'SKU-012',
                description: 'ספיישל',
                category: 'מיוחד',
                quantity: 20,
                productHandlingFlow: 'regular',
                planningStatus: 'special_flow',
                issues: [],
              },
              {
                rawDemandRowId: 'r2000000-0000-4000-8000-000000000004',
                sku: 'SKU-013',
                description: 'שגוי',
                category: 'כללי',
                quantity: 15,
                productHandlingFlow: 'regular',
                planningStatus: 'error',
                issues: [{ severity: 'error', code: 'MISSING_QUANTITY', message: 'Missing quantity', field: 'quantity' }],
              },
            ],
          },
        ],
        productSummary: [],
        issues: [],
      },
    ],
    specialFlows: [],
    errors: [],
  } as RawDemandPlanningPreview;
}

describe('buildDemandOrderId', () => {
  it('builds stable demand order ID with all parts', () => {
    const id = buildDemandOrderId(BATCH_ID, 'דרום', 'SO-001', 'לקוח א');
    expect(id).toBe('demand:b0000000-0000-4000-8000-000000000001:דרום:SO-001:לקוח א');
  });

  it('handles null parts with fallback labels', () => {
    const id = buildDemandOrderId(BATCH_ID, null, null, null);
    expect(id).toBe('demand:b0000000-0000-4000-8000-000000000001:no-area:no-order:no-customer');
  });
});

describe('adaptDemandPlanningPreviewToSource', () => {
  it('maps distributionArea to SourceArea', () => {
    const result = adaptDemandPlanningPreviewToSource(makePreview(), BATCH_ID);
    expect(result.areas).toHaveLength(1);
    expect(result.areas[0].areaName).toBe('דרום');
    expect(result.areas[0].displayName).toBe('דרום');
    expect(result.areas[0].totalOrders).toBe(2);
    expect(result.areas[0].totalQuantity).toBe(50);
  });

  it('maps orderNumber+customerName to SourceOrder with stable ID', () => {
    const result = adaptDemandPlanningPreviewToSource(makePreview(), BATCH_ID);
    expect(result.orders).toHaveLength(2);
    const order1 = result.orders[0];
    expect(order1.orderNumber).toBe('SO-001');
    expect(order1.customerName).toBe('לקוח א');
    expect(order1.orderId).toBe('demand:b0000000-0000-4000-8000-000000000001:דרום:SO-001:לקוח א');
    expect(order1.backendStatus).toBe('queued');
    expect(order1.hasAshlama).toBe(false);
    expect(order1.hasCheckUnits).toBe(false);
    expect(order1.sourceDeliveryLine).toBeNull();
    expect(order1.areaName).toBe('דרום');
  });

  it('sets SourceOrderItem.id to rawDemandRowId', () => {
    const result = adaptDemandPlanningPreviewToSource(makePreview(), BATCH_ID);
    const order1Id = buildDemandOrderId(BATCH_ID, 'דרום', 'SO-001', 'לקוח א');
    const items = result.orderItemMap[order1Id];
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe('r1000000-0000-4000-8000-000000000001');
    expect(items[1].id).toBe('r1000000-0000-4000-8000-000000000002');
  });

  it('preserves SKU, description, category, quantity on items', () => {
    const result = adaptDemandPlanningPreviewToSource(makePreview(), BATCH_ID);
    const order1Id = buildDemandOrderId(BATCH_ID, 'דרום', 'SO-001', 'לקוח א');
    const items = result.orderItemMap[order1Id];
    expect(items[0].sku).toBe('SKU-001');
    expect(items[0].description).toBe('מוצר 1');
    expect(items[0].category).toBe('כללי');
    expect(items[0].quantity).toBe(10);
    expect(items[1].sku).toBe('SKU-002');
    expect(items[1].quantity).toBe(20);
  });

  it('preserves productHandlingFlow, planningStatus on items', () => {
    const result = adaptDemandPlanningPreviewToSource(makePreview(), BATCH_ID);
    const order1Id = buildDemandOrderId(BATCH_ID, 'דרום', 'SO-001', 'לקוח א');
    const items = result.orderItemMap[order1Id];
    expect(items[0].productHandlingFlow).toBe('regular');
    expect(items[1].productHandlingFlow).toBe('cigarette');
    expect(items[0].planningStatus).toBe('unplanned');
  });

  it('does not set sourceRows (no fake provenance)', () => {
    const result = adaptDemandPlanningPreviewToSource(makePreview(), BATCH_ID);
    const order1Id = buildDemandOrderId(BATCH_ID, 'דרום', 'SO-001', 'לקוח א');
    const items = result.orderItemMap[order1Id];
    expect(items[0].sourceRows).toBeNull();
  });

  it('handles multiline orders with multiple items', () => {
    const result = adaptDemandPlanningPreviewToSource(makePreview(), BATCH_ID);
    const order1Id = buildDemandOrderId(BATCH_ID, 'דרום', 'SO-001', 'לקוח א');
    const items = result.orderItemMap[order1Id];
    expect(items).toHaveLength(2);
  });

  it('separates special_flow rows from normal items', () => {
    const result = adaptDemandPlanningPreviewToSource(makePreviewWithSpecialAndError(), BATCH_ID);
    const normalOrderId = buildDemandOrderId(BATCH_ID, 'צפון', 'SO-003', 'לקוח ג');
    const specialOrderId = `${normalOrderId}:special`;

    expect(result.orders.find((o) => o.orderId === normalOrderId)).toBeTruthy();
    const normalItems = result.orderItemMap[normalOrderId];
    expect(normalItems).toHaveLength(2);
    expect(normalItems.every((i) => i.planningStatus === 'unplanned')).toBe(true);

    expect(result.specialFlowOrders).toHaveLength(1);
    expect(result.specialFlowOrders[0].orderId).toBe(specialOrderId);
    const specialItems = result.orderItemMap[specialOrderId];
    expect(specialItems).toHaveLength(1);
    expect(specialItems[0].id).toBe('r2000000-0000-4000-8000-000000000003');
    expect(specialItems[0].isSpecialFlow).toBe(true);
  });

  it('separates error rows into error section', () => {
    const result = adaptDemandPlanningPreviewToSource(makePreviewWithSpecialAndError(), BATCH_ID);
    const normalOrderId = buildDemandOrderId(BATCH_ID, 'צפון', 'SO-003', 'לקוח ג');
    const errorOrderId = `${normalOrderId}:error`;

    expect(result.errorOrders).toHaveLength(1);
    expect(result.errorOrders[0].orderId).toBe(errorOrderId);
    const errorItems = result.orderItemMap[errorOrderId];
    expect(errorItems).toHaveLength(1);
    expect(errorItems[0].id).toBe('r2000000-0000-4000-8000-000000000004');
    expect(errorItems[0].isError).toBe(true);
    expect(errorItems[0].issues).toHaveLength(1);
    expect(errorItems[0].issues![0].code).toBe('MISSING_QUANTITY');
  });

  it('sets totalQuantity on order from preview', () => {
    const result = adaptDemandPlanningPreviewToSource(makePreview(), BATCH_ID);
    const order1 = result.orders[0];
    expect(order1.totalQuantity).toBe(30);
    const order2 = result.orders[1];
    expect(order2.totalQuantity).toBe(20);
  });

  it('handles empty preview', () => {
    const emptyPreview = makePreview({ distributionAreas: [] });
    const result = adaptDemandPlanningPreviewToSource(emptyPreview, BATCH_ID);
    expect(result.areas).toHaveLength(0);
    expect(result.orders).toHaveLength(0);
    expect(Object.keys(result.orderItemMap)).toHaveLength(0);
    expect(result.specialFlowItems).toHaveLength(0);
    expect(result.errorItems).toHaveLength(0);
  });

  it('handles multiple distribution areas', () => {
    const multiPreview = makePreview({
      distributionAreas: [
        ...makePreview().distributionAreas,
        {
          distributionArea: 'צפון',
          rowsCount: 2,
          ordersCount: 1,
          skuCount: 1,
          totalQuantity: 15,
          specialFlowRowsCount: 0,
          errorRowsCount: 0,
          orders: [
            {
              orderNumber: 'SO-010',
              customerName: 'לקוח צ',
              rowsCount: 1,
              skuCount: 1,
              totalQuantity: 15,
              productHandlingFlows: ['regular'],
              issues: [],
              items: [
                {
                  rawDemandRowId: 'r3000000-0000-4000-8000-000000000001',
                  sku: 'SKU-100',
                  description: 'צפוני',
                  category: 'כללי',
                  quantity: 15,
                  productHandlingFlow: 'regular',
                  planningStatus: 'unplanned',
                  issues: [],
                },
              ],
            },
          ],
          productSummary: [],
          issues: [],
        },
      ],
    });
    const result = adaptDemandPlanningPreviewToSource(multiPreview, BATCH_ID);
    expect(result.areas).toHaveLength(2);
    expect(result.areas[0].areaName).toBe('דרום');
    expect(result.areas[1].areaName).toBe('צפון');
    expect(result.orders).toHaveLength(3);
  });
});