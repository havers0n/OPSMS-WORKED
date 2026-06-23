import { describe, expect, it } from 'vitest';
import {
  normalizeWorkbookDate,
  parseManualShiftMonthlyPreview,
  planManualShiftMonthlyImportApply,
  type ParseManualShiftMonthlyPreviewInput
} from './manual-shift-monthly-import';

function buildInput(
  rows: ParseManualShiftMonthlyPreviewInput['rows'],
  selectedDate = '2026-06-14'
): ParseManualShiftMonthlyPreviewInput {
  return {
    source: {
      fileName: 'monthly.xlsx',
      sheetName: 'יוני 26'
    },
    selectedDate,
    rows
  };
}

describe('manual shift monthly import parser', () => {
  it('parses monthly preview and aggregates sku rows with preserved source rows', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'עמקים/נקודה א',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1001',
        description: 'מוצר א',
        category: 'cat',
        quantity: 2,
        notes: 'איסוף',
        zone: 'north'
      },
      {
        rowIndex: 3,
        distributionDateRaw: '14.06.26',
        rawDistributionValue: 'עמקים/נקודה א',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1001',
        description: 'מוצר א',
        category: 'cat',
        quantity: '3',
        notes: 'איסוף',
        zone: 'north'
      }
    ]));

    expect(result.preview.selectedDate).toEqual({
      raw: '14.06.26',
      normalized: '2026-06-14'
    });
    expect(result.preview.dateSummary).toMatchObject({
      totalRows: 2,
      matchingRows: 2,
      skippedOtherDateRows: 0
    });
    expect(result.preview.totals).toMatchObject({
      lines: 1,
      rawDistributionValues: 1,
      derivedPoints: 1,
      uniqueOrderNumbers: 1,
      orderGroups: 1,
      skuRows: 2,
      aggregatedSkuGroups: 1,
      uniqueSkus: 1,
      totalQuantity: 5,
      rawTotalQuantity: 5,
      positiveTotalQuantity: 5,
      negativeTotalQuantity: 0,
      zeroQuantityRowsCount: 0,
      negativeQuantityRowsCount: 0,
      positiveQuantityRowsCount: 2
    });
    expect(result.groups).toEqual([
      expect.objectContaining({
        lineName: 'עמקים',
        pointName: 'נקודה א',
        orderNumber: 'SO-1',
        sku: '1001',
        totalQuantity: 5,
        sourceRows: [2, 3],
        notes: ['איסוף']
      })
    ]);
    expect(result.preview.lines).toEqual([
      expect.objectContaining({
        lineName: 'עמקים',
        itemRows: 2,
        aggregatedSkuGroups: 1
      })
    ]);
  });

  it('supports adapter-normalized date values and skips rows from other dates', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateNormalized: '2026-06-14',
        rawDistributionValue: 'קו דרום/פז השקמה',
        customerName: 'פז',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 2
      },
      {
        rowIndex: 3,
        distributionDateNormalized: '2026-06-05',
        rawDistributionValue: 'קו דרום/פז השקמה',
        customerName: 'פז',
        orderNumber: 'SO-2',
        sku: '1002',
        quantity: 1
      }
    ]));

    expect(result.preview.dateSummary.availableDates).toEqual([
      { raw: '2026-06-05', normalized: '2026-06-05', rows: 1 },
      { raw: '2026-06-14', normalized: '2026-06-14', rows: 1 }
    ]);
    expect(result.preview.dateSummary.matchingRows).toBe(1);
    expect(result.preview.dateSummary.skippedOtherDateRows).toBe(1);
  });

  it('uses route value as point when distribution value has no slash', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'עמקים',
        customerName: 'לקוח fallback',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 2
      }
    ]));

    expect(result.preview.anomalies.rowsWithoutDistributionSlash).toBe(1);
    expect(result.preview.anomalies.pointFallbackRows).toBe(0);
    expect(result.groups[0]?.pointName).toBe('עמקים');
    expect(result.groups[0]?.customerName).toBe('לקוח fallback');
  });

  it('distinguishes unique order numbers from order groups', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'עמקים/נקודה א',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 2
      },
      {
        rowIndex: 3,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'עמקים/נקודה ב',
        customerName: 'לקוח ב',
        orderNumber: 'SO-1',
        sku: '1002',
        quantity: 1
      }
    ]));

    expect(result.preview.totals.uniqueOrderNumbers).toBe(1);
    expect(result.preview.totals.orderGroups).toBe(2);
  });

  it('preserves separate source zones in monthly aggregation and apply plan', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'שפלה 2/סלולר',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 2,
        zone: 'שפלה 2'
      },
      {
        rowIndex: 3,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'שפלה 2/סלולר',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 3,
        zone: 'שפלה אמצעי'
      }
    ]));

    expect(result.groups).toHaveLength(2);
    expect(result.groups.map((group) => group.sourceZone).sort()).toEqual(['שפלה 2', 'שפלה אמצעי']);
    expect(result.preview.totals.aggregatedSkuGroups).toBe(2);
    expect(result.preview.lines[0]).toMatchObject({
      lineName: 'שפלה 2',
      itemRows: 2,
      aggregatedSkuGroups: 2
    });

    const plan = planManualShiftMonthlyImportApply(result);
    expect(plan.lines[0].orders).toHaveLength(2);
    expect(plan.lines[0].orders.map((order) => order.sourceZone).sort()).toEqual(['שפלה 2', 'שפלה אמצעי']);
    expect(plan.lines[0].orders).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceZone: 'שפלה 2',
        items: expect.arrayContaining([expect.objectContaining({ zone: 'שפלה 2' })])
      }),
      expect.objectContaining({
        sourceZone: 'שפלה אמצעי',
        items: expect.arrayContaining([expect.objectContaining({ zone: 'שפלה אמצעי' })])
      })
    ]));
  });

  it('counts negative quantity and note anomalies', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'עמקים/נקודה א',
        customerName: 'לקוח א',
        orderNumber: 'תעודה קיימת',
        sku: '1001',
        quantity: -2,
        notes: 'איסוף והשלמה'
      }
    ]));

    expect(result.preview.anomalies).toMatchObject({
      negativeQuantityRows: 1,
      nonSoOrderRows: 1,
      pickupNoteRows: 1,
      ashlamaNoteRows: 1
    });
    expect(result.preview.warnings.map((warning) => warning.code)).toEqual([
      'NEGATIVE_QUANTITY_ROWS',
      'NON_SO_ORDER_ROWS',
      'SPECIAL_FLOW_ROWS_DETECTED'
    ]);
  });

  it('treats blank quantity as missing required field and blocking warning', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'עמקים/נקודה א',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: '   '
      }
    ]));

    expect(result.preview.anomalies.missingRequiredFields).toEqual([
      { rowIndex: 2, fields: ['quantity'] }
    ]);
    expect(result.preview.warnings).toContainEqual(expect.objectContaining({
      severity: 'blocking',
      code: 'MISSING_REQUIRED_FIELDS'
    }));
    expect(result.groups).toEqual([]);
  });

  it('does not block selected-date preview for missing fields on other valid dates', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'Line A/Point A',
        customerName: 'Customer A',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 2
      },
      {
        rowIndex: 3,
        distributionDateRaw: '5.6.26',
        rawDistributionValue: 'Line B/Point B',
        customerName: 'Customer B',
        orderNumber: 'SO-2',
        sku: '   ',
        quantity: '   '
      }
    ]));

    expect(result.preview.dateSummary).toMatchObject({
      matchingRows: 1,
      skippedOtherDateRows: 1
    });
    expect(result.preview.anomalies.missingRequiredFields).toEqual([]);
    expect(result.preview.warnings.map((warning) => warning.code)).not.toContain('MISSING_REQUIRED_FIELDS');
    expect(result.preview.totals.orderGroups).toBe(1);
  });

  it('reports rows with missing or invalid distribution date separately', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: 'not-a-date',
        rawDistributionValue: 'Line A/Point A',
        customerName: 'Customer A',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 2
      },
      {
        rowIndex: 3,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'Line B/Point B',
        customerName: 'Customer B',
        orderNumber: 'SO-2',
        sku: '1002',
        quantity: 1
      }
    ]));

    expect(result.preview.anomalies.invalidDistributionDateRows).toEqual([2]);
    expect(result.preview.anomalies.missingRequiredFields).toEqual([]);
    expect(result.preview.warnings).toContainEqual(expect.objectContaining({
      severity: 'blocking',
      code: 'INVALID_DISTRIBUTION_DATE_ROWS',
      rows: [2]
    }));
    expect(result.preview.totals.orderGroups).toBe(1);
  });

  it('returns blocking warning and zero matching groups when selected date is not found', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '5.6.26',
        rawDistributionValue: 'עמקים/נקודה א',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 2
      }
    ]));

    expect(result.preview.selectedDate.raw).toBeNull();
    expect(result.preview.dateSummary).toMatchObject({
      matchingRows: 0,
      skippedOtherDateRows: 1
    });
    expect(result.preview.totals.orderGroups).toBe(0);
    expect(result.preview.totals.aggregatedSkuGroups).toBe(0);
    expect(result.groups).toEqual([]);
    expect(result.preview.warnings).toContainEqual(expect.objectContaining({
      severity: 'blocking',
      code: 'SELECTED_DATE_NOT_FOUND'
    }));
  });

  it('parses distribution area and hierarchy fields with slash — area separate from group prefix', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/סלולר',
        customerName: 'לקוח',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 2,
        zone: 'דרום'
      }
    ]));

    expect(result.groups[0]).toMatchObject({
      distributionArea: 'דרום',
      lineRawName: 'קו דרום/סלולר',
      lineGroupName: 'קו דרום',
      lineBucketName: 'סלולר'
    });
    expect(result.groups[0].lineName).toBe('קו דרום');
    expect(result.groups[0].pointName).toBe('סלולר');
  });

  it('does not use prefix before slash as distribution area — area comes from zone field', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'שפלה צפונית/פז עוקף רמלה',
        customerName: 'לקוח',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 2,
        zone: 'שפלה 1'
      }
    ]));

    expect(result.groups[0]).toMatchObject({
      distributionArea: 'שפלה 1',
      lineGroupName: 'שפלה צפונית',
      lineBucketName: 'פז עוקף רמלה'
    });
    expect(result.groups[0].lineName).toBe('שפלה צפונית');
    expect(result.groups[0].pointName).toBe('פז עוקף רמלה');
  });

  it('handles no-slash case with lineBucketName set to route value', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום',
        customerName: 'לקוח fallback',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 2,
        zone: 'דרום'
      }
    ]));

    expect(result.groups[0]).toMatchObject({
      distributionArea: 'דרום',
      lineRawName: 'קו דרום',
      lineGroupName: 'קו דרום',
      lineBucketName: 'קו דרום'
    });
    expect(result.groups[0].lineName).toBe('קו דרום');
    expect(result.groups[0].pointName).toBe('קו דרום');
    expect(result.groups[0].customerName).toBe('לקוח fallback');
  });

  it('sets isNonDistributionRow true when notes contain איסוף', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/סלולר',
        customerName: 'לקוח',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 2,
        notes: 'איסוף',
        zone: 'דרום'
      }
    ]));

    expect(result.groups[0].isNonDistributionRow).toBe(true);
  });

  it('sets isNonDistributionRow false when notes lack איסוף', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/סלולר',
        customerName: 'לקוח',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 2,
        zone: 'דרום'
      }
    ]));

    expect(result.groups[0].isNonDistributionRow).toBe(false);
  });

  it('includes distributionArea and lineGroupName in preview lines', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/סלולר',
        customerName: 'לקוח',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 2,
        zone: 'דרום'
      },
      {
        rowIndex: 3,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/פז השקמה',
        customerName: 'פז',
        orderNumber: 'SO-2',
        sku: '1002',
        quantity: 1,
        zone: 'דרום'
      }
    ]));

    expect(result.preview.lines[0]).toMatchObject({
      lineName: 'קו דרום',
      distributionArea: 'דרום',
      lineGroupName: 'קו דרום'
    });
    expect(Object.keys(result.preview.lines[0])).not.toContain('lineBucketName');
    expect(Object.keys(result.preview.lines[0])).not.toContain('lineRawName');
  });

  it('includes distributionArea and lineGroupName in apply plan lines', () => {
    const preview = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/סלולר',
        customerName: 'לקוח',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 2,
        zone: 'דרום'
      }
    ]));
    const plan = planManualShiftMonthlyImportApply(preview);

    expect(plan.lines[0]).toMatchObject({
      lineName: 'קו דרום',
      distributionArea: 'דרום',
      lineGroupName: 'קו דרום'
    });
    expect(Object.keys(plan.lines[0])).not.toContain('lineBucketName');
    expect(Object.keys(plan.lines[0])).not.toContain('lineRawName');
  });

  it('preserves hierarchy fields with null zone (no distribution area column)', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/סלולר',
        customerName: 'לקוח',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 2
      }
    ]));

    expect(result.groups[0]).toMatchObject({
      distributionArea: null,
      lineRawName: 'קו דרום/סלולר',
      lineGroupName: 'קו דרום',
      lineBucketName: 'סלולר'
    });
    expect(result.groups[0].lineName).toBe('קו דרום');
    expect(result.groups[0].pointName).toBe('סלולר');
  });

  it('plans apply only positive source rows when a grouped sku mixes positive, negative, and zero rows', () => {
    const preview = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'עמקים/נקודה א',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1001',
        description: 'מוצר א',
        category: 'cat',
        quantity: 5,
        notes: 'first'
      },
      {
        rowIndex: 3,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'עמקים/נקודה א',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1001',
        description: 'מוצר א',
        category: 'cat',
        quantity: -1,
        notes: 'second'
      },
      {
        rowIndex: 4,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'עמקים/נקודה ב',
        customerName: 'לקוח ב',
        orderNumber: 'SO-2',
        sku: '1002',
        description: 'מוצר ב',
        category: 'cat',
        quantity: 0
      }
    ]));

    const plan = planManualShiftMonthlyImportApply(preview);

    expect(plan.skippedGroups).toBe(1);
    expect(plan.skippedNegativeQuantityRows).toBe(1);
    expect(plan.skippedZeroQuantityRows).toBe(1);
    expect(plan.lines).toHaveLength(1);
    expect(plan.lines[0]).toMatchObject({
      orders: [{
        orderNumber: 'SO-1',
        totalQuantity: 5,
        items: [{
          sku: '1001',
          quantity: 5,
          notes: 'first',
          sourceRows: [2]
        }]
      }]
    });
  });

  it('A: persists customerName from parsed row into apply plan order', () => {
    const preview = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/סלולר',
        customerName: 'לקוח בדיקה',
        orderNumber: 'SO26000001',
        sku: '1001',
        quantity: 3
      }
    ]));
    const plan = planManualShiftMonthlyImportApply(preview);

    expect(plan.lines[0]).toMatchObject({
      lineName: 'קו דרום',
      orders: [{
        pointName: 'סלולר',
        customerName: 'לקוח בדיקה',
        orderNumber: 'SO26000001'
      }]
    });
  });

  it('B: no-slash uses route value as pointName while preserving customerName separately', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום',
        customerName: 'לקוח ללא סלאש',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 5
      }
    ]));
    const plan = planManualShiftMonthlyImportApply(result);

    expect(result.groups[0].pointName).toBe('קו דרום');
    expect(result.groups[0].customerName).toBe('לקוח ללא סלאש');
    expect(result.groups[0].lineName).toBe('קו דרום');
    expect(plan.lines[0].orders[0]).toMatchObject({
      pointName: 'קו דרום',
      customerName: 'לקוח ללא סלאש'
    });
  });

  it('C: item zone persistence from איזור הפצה into apply plan item', () => {
    const preview = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/סלולר',
        customerName: 'לקוח',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 3,
        zone: 'דרום'
      }
    ]));
    const plan = planManualShiftMonthlyImportApply(preview);

    expect(plan.lines[0]).toMatchObject({
      distributionArea: 'דרום'
    });
    expect(plan.lines[0].orders[0].items[0]).toMatchObject({
      zone: 'דרום'
    });
  });

  it('D: prefix is not area — zone is separate from line group prefix', () => {
    const preview = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'שפלה צפונית/פז עוקף רמלה',
        customerName: 'לקוח',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 5,
        zone: 'שפלה 1'
      }
    ]));
    const plan = planManualShiftMonthlyImportApply(preview);

    expect(preview.groups[0].lineName).toBe('שפלה צפונית');
    expect(preview.groups[0].distributionArea).toBe('שפלה 1');
    expect(plan.lines[0].distributionArea).toBe('שפלה 1');
    expect(plan.lines[0].orders[0].pointName).toBe('פז עוקף רמלה');
    expect(plan.lines[0].orders[0].items[0].zone).toBe('שפלה 1');
  });

  it('E: duplicate rows for same date/line/point/order/sku still aggregate quantity and notes', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/סלולר',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 2,
        notes: 'הערה 1'
      },
      {
        rowIndex: 3,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/סלולר',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 3,
        notes: 'הערה 2'
      }
    ]));

    expect(result.preview.totals.aggregatedSkuGroups).toBe(1);
    expect(result.groups[0].totalQuantity).toBe(5);
    expect(result.groups[0].notes).toContain('הערה 1');
    expect(result.groups[0].notes).toContain('הערה 2');
    expect(result.groups[0].sourceRows).toEqual([2, 3]);
  });

  it('F: negative and zero quantity rows produce anomalies but are not applied', () => {
    const preview = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/סלולר',
        customerName: 'לקוח',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: -2
      },
      {
        rowIndex: 3,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/סלולר',
        customerName: 'לקוח',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 0
      }
    ]));

    expect(preview.preview.anomalies.negativeQuantityRows).toBe(1);
    expect(preview.preview.warnings).toContainEqual(expect.objectContaining({
      code: 'NEGATIVE_QUANTITY_ROWS'
    }));

    const plan = planManualShiftMonthlyImportApply(preview);
    expect(plan.skippedGroups).toBe(1);
    expect(plan.skippedNegativeQuantityRows).toBe(1);
    expect(plan.skippedZeroQuantityRows).toBe(1);
    expect(plan.appliedGroups).toBe(0);
    expect(plan.lines).toEqual([]);
  });

  it('detects conflicting customer names for same apply order and sets customerName to null', () => {
    const preview = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/סלולר',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 2
      },
      {
        rowIndex: 3,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/סלולר',
        customerName: 'לקוח ב',
        orderNumber: 'SO-1',
        sku: '1002',
        quantity: 3
      }
    ]));

    const plan = planManualShiftMonthlyImportApply(preview);

    expect(plan.lines[0].orders[0].customerName).toBeNull();
    expect(plan.warningSummary.warning).toBeGreaterThanOrEqual(1);
    expect(plan.preview.warnings).toContainEqual(expect.objectContaining({
      severity: 'warning',
      code: 'CUSTOMER_NAME_CONFLICTS'
    }));
  });

  it('does not flag conflict when all customer names for same order are identical', () => {
    const preview = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/סלולר',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 2
      },
      {
        rowIndex: 3,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/סלולר',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1002',
        quantity: 3
      }
    ]));

    const plan = planManualShiftMonthlyImportApply(preview);

    expect(plan.lines[0].orders[0].customerName).toBe('לקוח א');
  });

  it('does not flag conflict when one of the rows has null customerName', () => {
    const preview = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/סלולר',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 2
      },
      {
        rowIndex: 3,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/סלולר',
        customerName: null,
        orderNumber: 'SO-1',
        sku: '1002',
        quantity: 3
      }
    ]));

    const plan = planManualShiftMonthlyImportApply(preview);

    expect(plan.lines[0].orders[0].customerName).toBe('לקוח א');
  });

  it('C: no-slash route must not use customerName as pointName', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'חיפה',
        customerName: 'דור אלון - דלית אל כרמל',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 2,
        zone: 'חיפה'
      }
    ]));

    expect(result.groups[0].pointName).toBe('חיפה');
    expect(result.groups[0].customerName).toBe('דור אלון - דלית אל כרמל');
    expect(result.groups[0].pointName).not.toBe(result.groups[0].customerName);
    expect(result.groups[0].lineName).toBe('חיפה');
    expect(result.groups[0].distributionArea).toBe('חיפה');
    expect(result.groups[0].lineBucketName).toBe('חיפה');
    expect(result.preview.anomalies.pointFallbackRows).toBe(0);
  });

  it('D: mixed slash and no-slash rows under same orderNumber produce separate buckets without conflict', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'חיפה/רכב',
        customerName: 'ספרינט מוטורס',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 3
      },
      {
        rowIndex: 3,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'חיפה',
        customerName: 'ספרינט מוטורס',
        orderNumber: 'SO-1',
        sku: '1002',
        quantity: 2
      }
    ]));

    const plan = planManualShiftMonthlyImportApply(result);

    expect(result.preview.totals.lines).toBe(1);
    expect(result.preview.totals.derivedPoints).toBe(2);

    const orderKeys = plan.lines[0].orders.map((o) => o.pointName).sort();
    expect(orderKeys).toEqual(['חיפה', 'רכב']);

    expect(plan.lines[0].orders[0].customerName).toBe('ספרינט מוטורס');
    expect(plan.lines[0].orders[1].customerName).toBe('ספרינט מוטורס');

    const conflictWarning = plan.preview.warnings.find((w) => w.code === 'CUSTOMER_NAME_CONFLICTS');
    expect(conflictWarning).toBeUndefined();
  });

  // ── Corrected model regression tests ─────────────────────────────────────────
  // The corrected model: ManualShift → DistributionArea → RouteLine → WorkBucket → OrderFragment → Items
  // These tests lock current behavior and flag needed changes.
  // ─────────────────────────────────────────────────────────────────────────────

  it('E: one order number in different work buckets under same line produces separate order fragments', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'דרום/סלולר',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 3
      },
      {
        rowIndex: 3,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'דרום/פז השקמה',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1002',
        quantity: 2
      }
    ]));
    const plan = planManualShiftMonthlyImportApply(result);

    // One line, two distinct pointNames (= work bucket names)
    expect(result.preview.totals.lines).toBe(1);
    expect(result.preview.totals.derivedPoints).toBe(2);
    expect(result.preview.totals.uniqueOrderNumbers).toBe(1);
    expect(result.preview.totals.orderGroups).toBe(2);

    // Two separate order fragments, one per bucket
    expect(plan.lines).toHaveLength(1);
    expect(plan.lines[0].orders).toHaveLength(2);
    const bucketNames = plan.lines[0].orders.map((o) => o.pointName).sort();
    expect(bucketNames).toEqual(['סלולר', 'פז השקמה']);

    // Each fragment preserves its own customerName independently
    for (const order of plan.lines[0].orders) {
      expect(order.customerName).toBe('לקוח א');
      expect(order.orderNumber).toBe('SO-1');
    }

    // No customer name conflict — same customer across buckets is fine
    const conflictWarning = plan.preview.warnings.find((w) => w.code === 'CUSTOMER_NAME_CONFLICTS');
    expect(conflictWarning).toBeUndefined();
  });

  it('F: suffix after "/" is workBucketName — not derived from customerName or delivery point', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'צפון/סלולר',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 5
      }
    ]));

    // pointName = the suffix after "/" = work bucket name
    expect(result.groups[0].pointName).toBe('סלולר');
    expect(result.groups[0].lineBucketName).toBe('סלולר');

    // customerName is NOT pointName — it is the delivery stop candidate
    expect(result.groups[0].customerName).toBe('לקוח א');
    expect(result.groups[0].pointName).not.toBe(result.groups[0].customerName);

    // customerName is never used as fallback for pointName
    expect(result.groups[0].pointName).not.toBe('לקוח א');
    expect(result.preview.anomalies.pointFallbackRows).toBe(0);
  });

  it('G: customerName is the delivery/customer stop candidate — preserved per work bucket', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'צפון/סלולר',
        customerName: 'פז השקמה',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 3
      },
      {
        rowIndex: 3,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'צפון/מרכז',
        customerName: 'דלק',
        orderNumber: 'SO-2',
        sku: '1002',
        quantity: 2
      }
    ]));
    const plan = planManualShiftMonthlyImportApply(result);

    // Each work bucket order fragment has its own customerName
    const ordersByPoint = new Map(plan.lines[0].orders.map((o) => [o.pointName, o]));
    expect(ordersByPoint.get('סלולר')?.customerName).toBe('פז השקמה');
    expect(ordersByPoint.get('מרכז')?.customerName).toBe('דלק');

    // customerName is the real delivery/customer stop, not the route bucket
    expect(ordersByPoint.get('סלולר')?.customerName).not.toBe('סלולר');
    expect(ordersByPoint.get('מרכז')?.customerName).not.toBe('מרכז');
  });

  it('H: rows with distributionArea but no route line ARE blocked today (proving current guard)', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: null,
        customerName: 'לקוח ללא קו',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 5,
        zone: 'צפון'
      }
    ]));

    // Current behavior: MISSING_REQUIRED_FIELDS blocking warning (line + point missing)
    expect(result.groups).toEqual([]);
    expect(result.preview.warnings).toContainEqual(expect.objectContaining({
      severity: 'blocking',
      code: 'MISSING_REQUIRED_FIELDS'
    }));
    expect(result.preview.anomalies.missingRequiredFields).toContainEqual(
      expect.objectContaining({ rowIndex: 2, fields: expect.arrayContaining(['line', 'point']) })
    );
  });

  it('I: rows with distributionArea but no route line SHOULD be dispatch candidates, not blocked — FAILING TEST', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: null,
        rawDistributionValue: null,
        customerName: 'לקוח ללא קו',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 5,
        zone: 'צפון'
      }
    ]));

    // ── DESIRED BEHAVIOR (not yet implemented) ──
    // These rows should be classified as dispatch_candidates, not blocked:
    // They have a distribution area but no route line and no dispatch date.
    //
    // The test currently FAILS because:
    // 1. MISSING_REQUIRED_FIELDS blocking warning is raised
    // 2. No dispatchCandidates concept exists
    // 3. INVALID_DISTRIBUTION_DATE_ROWS blocking warning is raised
    //
    // Once dispatch_candidates are implemented, this test will pass with the
    // assertions below uncommented and the current-behavior assertions removed.

    // Assertions proving the current (undesired) behavior:
    expect(result.groups).toEqual([]);
    const blockingWarnings = result.preview.warnings.filter((w) => w.severity === 'blocking');
    expect(blockingWarnings.length).toBeGreaterThanOrEqual(1);

    // ── DESIRED ASSERTIONS (activate when dispatch_candidates feature lands) ──
    // expect(result.preview.warnings.filter(w => w.code === 'MISSING_REQUIRED_FIELDS')).toHaveLength(0);
    // expect(result.preview.warnings.filter(w => w.code === 'INVALID_DISTRIBUTION_DATE_ROWS')).toHaveLength(0);
    // expect(result.preview.dispatchCandidates).toBeDefined();
    // expect(result.preview.dispatchCandidates).toHaveLength(1);
    // expect(result.preview.dispatchCandidates[0]).toMatchObject({
    //   distributionArea: 'צפון',
    //   customerName: 'לקוח ללא קו',
    //   orderNumber: 'SO-1'
    // });
  });

  // ── PR G2: Date format parsing ─────────────────────────────────────────────

  describe('normalizeWorkbookDate', () => {
    const cases: [string, string | null][] = [
      // Date object
      ['Date', '2026-06-03'],
      // YYYY-MM-DD
      ['2026-06-03', '2026-06-03'],
      // YYYY/MM/DD
      ['2026/06/03', '2026-06-03'],
      // DD/MM/YYYY
      ['03/06/2026', '2026-06-03'],
      ['3/6/2026', '2026-06-03'],
      // DD.MM.YYYY
      ['03.06.2026', '2026-06-03'],
      ['3.6.2026', '2026-06-03'],
      // DD/MM/YY (two-digit year)
      ['03/06/26', '2026-06-03'],
      ['3/6/26', '2026-06-03'],
      // DD.MM.YY (two-digit year)
      ['03.06.26', '2026-06-03'],
      ['3.6.26', '2026-06-03'],
      // Two-digit year boundary: 00-69 → 2000-2069, 70-99 → 1970-1999
      ['1.1.00', '2000-01-01'],
      ['1.1.69', '2069-01-01'],
      ['1.1.70', '1970-01-01'],
      ['1.1.99', '1999-01-01'],
      ['1/1/00', '2000-01-01'],
      ['1/1/99', '1999-01-01'],
      // Invalid dates
      ['32.6.26', null],
      ['3.13.26', null],
      ['not-a-date', null],
      ['', null],
      ['   ', null],
    ];

    it.each(cases)('parses "%s" → %s', (input, expected) => {
      const value = input === 'Date' ? new Date(Date.UTC(2026, 5, 3)) : input;
      expect(normalizeWorkbookDate(value)).toBe(expected);
    });
  });

  // ── PR G2: Preview date filtering across mixed formats ──────────────────────

  describe('preview filtering with mixed date formats', () => {
    it('includes rows with different date formats but same logical date', () => {
      const result = parseManualShiftMonthlyPreview(buildInput([
        {
          rowIndex: 2,
          distributionDateRaw: '3.6.26',
          rawDistributionValue: 'עמקים/נקודה א',
          customerName: 'לקוח א',
          orderNumber: 'SO-1',
          sku: '1001',
          quantity: 2
        },
        {
          rowIndex: 3,
          distributionDateRaw: '03/06/2026',
          rawDistributionValue: 'עמקים/נקודה א',
          customerName: 'לקוח ב',
          orderNumber: 'SO-2',
          sku: '1002',
          quantity: 3
        },
        {
          rowIndex: 4,
          distributionDateRaw: '2026-06-03',
          rawDistributionValue: 'עמקים/נקודה א',
          customerName: 'לקוח ג',
          orderNumber: 'SO-3',
          sku: '1003',
          quantity: 1
        }
      ], '2026-06-03'));

      expect(result.preview.dateSummary.matchingRows).toBe(3);
      expect(result.preview.dateSummary.skippedOtherDateRows).toBe(0);
      expect(result.preview.selectedDate).toEqual({
        raw: '03/06/2026',
        normalized: '2026-06-03'
      });
    });

    it('skips rows from other dates', () => {
      const result = parseManualShiftMonthlyPreview(buildInput([
        {
          rowIndex: 2,
          distributionDateRaw: '3.6.26',
          rawDistributionValue: 'עמקים/נקודה א',
          customerName: 'לקוח א',
          orderNumber: 'SO-1',
          sku: '1001',
          quantity: 2
        },
        {
          rowIndex: 3,
          distributionDateRaw: '4.6.26',
          rawDistributionValue: 'עמקים/נקודה א',
          customerName: 'לקוח ב',
          orderNumber: 'SO-2',
          sku: '1002',
          quantity: 3
        }
      ], '2026-06-03'));

      expect(result.preview.dateSummary.matchingRows).toBe(1);
      expect(result.preview.dateSummary.skippedOtherDateRows).toBe(1);
      expect(result.preview.totals.aggregatedSkuGroups).toBe(1);
    });
  });

  // ── PR G2: Invalid date diagnostics ─────────────────────────────────────────

  describe('invalid date diagnostics', () => {
    it('preserves structured diagnostics for invalid distribution dates', () => {
      const result = parseManualShiftMonthlyPreview(buildInput([
        {
          rowIndex: 2,
          distributionDateRaw: '32.6.26',
          rawDistributionValue: 'עמקים/נקודה א',
          customerName: 'לקוח א',
          orderNumber: 'SO-1',
          sku: '1001',
          quantity: 2
        },
        {
          rowIndex: 3,
          distributionDateRaw: 'not-a-date',
          rawDistributionValue: 'עמקים/נקודה ב',
          customerName: 'לקוח ב',
          orderNumber: 'SO-2',
          sku: '1002',
          quantity: 1
        }
      ]));

      expect(result.preview.anomalies.invalidDistributionDateRows).toEqual([2, 3]);
      expect(result.preview.anomalies.invalidDateDetails).toBeDefined();
      expect(result.preview.anomalies.invalidDateDetails).toHaveLength(2);
      expect(result.preview.anomalies.invalidDateDetails![0]).toMatchObject({
        rowIndex: 2,
        rawValue: '32.6.26',
        fieldName: 'תאריך הפצה',
        reason: 'invalid date format'
      });
      expect(result.preview.anomalies.invalidDateDetails![1]).toMatchObject({
        rowIndex: 3,
        rawValue: 'not-a-date',
        fieldName: 'תאריך הפצה',
        reason: 'invalid date format'
      });
    });

    it('handles empty date as missing (preserving existing behavior)', () => {
      const result = parseManualShiftMonthlyPreview(buildInput([
        {
          rowIndex: 2,
          distributionDateRaw: '',
          rawDistributionValue: 'עמקים/נקודה א',
          customerName: 'לקוח',
          orderNumber: 'SO-1',
          sku: '1001',
          quantity: 2
        }
      ]));

      expect(result.preview.anomalies.invalidDistributionDateRows).toEqual([2]);
      expect(result.preview.anomalies.invalidDateDetails).toHaveLength(1);
      expect(result.preview.anomalies.invalidDateDetails![0].rawValue).toBeNull();
    });
  });

  // ── PR G2: Two-digit year rule ──────────────────────────────────────────────

  describe('two-digit year policy', () => {
    it('applies 00-69 → 2000-2069, 70-99 → 1970-1999 rule', () => {
      // Note: raw dates are pre-normalized by adapter; the domain function
      // normalizeWorkbookDate handles the resolution.
      const result = parseManualShiftMonthlyPreview(buildInput([
        // 00 → 2000
        {
          rowIndex: 2,
          distributionDateRaw: '1.1.00',
          rawDistributionValue: 'עמקים/נקודה א',
          customerName: 'לקוח',
          orderNumber: 'SO-1',
          sku: '1001',
          quantity: 1
        },
        // 69 → 2069
        {
          rowIndex: 3,
          distributionDateRaw: '1.1.69',
          rawDistributionValue: 'עמקים/נקודה א',
          customerName: 'לקוח',
          orderNumber: 'SO-2',
          sku: '1002',
          quantity: 1
        },
        // 70 → 1970
        {
          rowIndex: 4,
          distributionDateRaw: '1.1.70',
          rawDistributionValue: 'עמקים/נקודה א',
          customerName: 'לקוח',
          orderNumber: 'SO-3',
          sku: '1003',
          quantity: 1
        },
        // 99 → 1999
        {
          rowIndex: 5,
          distributionDateRaw: '1.1.99',
          rawDistributionValue: 'עמקים/נקודה א',
          customerName: 'לקוח',
          orderNumber: 'SO-4',
          sku: '1004',
          quantity: 1
        }
      ], '2000-01-01'));

      expect(result.preview.dateSummary.matchingRows).toBe(1);
      expect(result.preview.dateSummary.availableDates.map(d => d.normalized)).toContain('2000-01-01');
      expect(result.preview.dateSummary.availableDates.map(d => d.normalized)).toContain('2069-01-01');
      expect(result.preview.dateSummary.availableDates.map(d => d.normalized)).toContain('1970-01-01');
      expect(result.preview.dateSummary.availableDates.map(d => d.normalized)).toContain('1999-01-01');
    });
  });

  // ── PR C: canonical route/work bucket fields ────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────

  it('C(a): no-slash route produces rawRouteLine/routeBase but null workBucketName/workBucketType', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'חיפה',
        customerName: 'דור אלון - דלית אל כרמל',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 2,
        zone: 'חיפה'
      }
    ]));

    const group = result.groups[0];
    expect(group.rawRouteLine).toBe('חיפה');
    expect(group.routeBase).toBe('חיפה');
    expect(group.workBucketName).toBeNull();
    expect(group.workBucketType).toBeNull();
    expect(group.lineName).toBe('חיפה');
    expect(group.pointName).toBe('חיפה');
    expect(group.pointName).toBe(group.lineName);

    const plan = planManualShiftMonthlyImportApply(result);
    expect(plan.lines[0].orders[0].workBucketName).toBeNull();
    expect(plan.lines[0].orders[0].workBucketType).toBeNull();
    expect(plan.lines[0].orders[0].rawRouteLine).toBe('חיפה');
    expect(plan.lines[0].orders[0].routeBase).toBe('חיפה');
  });

  it('C(b): slash route with category bucket produces canonical fields with workBucketType=unknown', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'דרום/סלולר',
        customerName: 'לקוח',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 3
      }
    ]));

    const group = result.groups[0];
    expect(group.rawRouteLine).toBe('דרום/סלולר');
    expect(group.routeBase).toBe('דרום');
    expect(group.workBucketName).toBe('סלולר');
    expect(group.workBucketType).toBe('unknown');
    expect(group.lineName).toBe('דרום');
    expect(group.pointName).toBe('סלולר');
    expect(group.lineBucketName).toBe('סלולר');

    const plan = planManualShiftMonthlyImportApply(result);
    expect(plan.lines[0].orders[0].workBucketName).toBe('סלולר');
    expect(plan.lines[0].orders[0].workBucketType).toBe('unknown');
    expect(plan.lines[0].orders[0].rawRouteLine).toBe('דרום/סלולר');
    expect(plan.lines[0].orders[0].routeBase).toBe('דרום');
  });

  it('C(c): slash route with customer-like bucket preserves workBucketName separately from customerName', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'צפון/פז השקמה',
        customerName: 'דלק',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 2
      }
    ]));

    const group = result.groups[0];
    expect(group.rawRouteLine).toBe('צפון/פז השקמה');
    expect(group.routeBase).toBe('צפון');
    expect(group.workBucketName).toBe('פז השקמה');
    expect(group.workBucketType).toBe('unknown');
    expect(group.customerName).toBe('דלק');
    expect(group.workBucketName).not.toBe(group.customerName);
    expect(group.pointName).toBe('פז השקמה');
  });

  it('C(d): same SO split across multiple workBucketName values produces separate fragments with correct canonical fields', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'דרום/סלולר',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 3
      },
      {
        rowIndex: 3,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'דרום/פז השקמה',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1002',
        quantity: 2
      }
    ]));

    expect(result.preview.totals.lines).toBe(1);
    expect(result.preview.totals.derivedPoints).toBe(2);

    const plan = planManualShiftMonthlyImportApply(result);
    expect(plan.lines).toHaveLength(1);
    expect(plan.lines[0].orders).toHaveLength(2);

    const orderByBucket = new Map(plan.lines[0].orders.map((o) => [o.pointName, o]));
    const bucket1 = orderByBucket.get('סלולר')!;
    const bucket2 = orderByBucket.get('פז השקמה')!;

    expect(bucket1.workBucketName).toBe('סלולר');
    expect(bucket1.workBucketType).toBe('unknown');
    expect(bucket1.orderNumber).toBe('SO-1');
    expect(bucket1.customerName).toBe('לקוח א');
    expect(bucket1.rawRouteLine).toBe('דרום/סלולר');
    expect(bucket1.routeBase).toBe('דרום');

    expect(bucket2.workBucketName).toBe('פז השקמה');
    expect(bucket2.workBucketType).toBe('unknown');
    expect(bucket2.orderNumber).toBe('SO-1');
    expect(bucket2.customerName).toBe('לקוח א');
    expect(bucket2.rawRouteLine).toBe('דרום/פז השקמה');
    expect(bucket2.routeBase).toBe('דרום');
  });

  // ── PR G3: Monthly Import Quantity Transparency ─────────────────────────

  describe('PR G3 — quantity accounting', () => {
    it('G1: computes correct raw/positive/negative/zero totals from mixed rows', () => {
      const result = parseManualShiftMonthlyPreview(buildInput([
        {
          rowIndex: 2,
          distributionDateRaw: '14.6.26',
          rawDistributionValue: 'עמקים/נקודה א',
          customerName: 'לקוח א',
          orderNumber: 'SO-1',
          sku: '1001',
          quantity: 10
        },
        {
          rowIndex: 3,
          distributionDateRaw: '14.6.26',
          rawDistributionValue: 'עמקים/נקודה א',
          customerName: 'לקוח א',
          orderNumber: 'SO-2',
          sku: '1002',
          quantity: -3
        },
        {
          rowIndex: 4,
          distributionDateRaw: '14.6.26',
          rawDistributionValue: 'עמקים/נקודה א',
          customerName: 'לקוח א',
          orderNumber: 'SO-3',
          sku: '1003',
          quantity: 0
        },
        {
          rowIndex: 5,
          distributionDateRaw: '14.6.26',
          rawDistributionValue: 'עמקים/נקודה א',
          customerName: 'לקוח א',
          orderNumber: 'SO-4',
          sku: '1004',
          quantity: 5
        }
      ]));

      expect(result.preview.totals).toMatchObject({
        rawTotalQuantity: 12,
        positiveTotalQuantity: 15,
        negativeTotalQuantity: -3,
        positiveQuantityRowsCount: 2,
        negativeQuantityRowsCount: 1,
        zeroQuantityRowsCount: 1
      });

      const plan = planManualShiftMonthlyImportApply(result);
      expect(plan.appliedTotalQuantity).toBe(15);
      expect(plan.appliedItemLines).toBe(2);
      expect(plan.skippedGroups).toBe(2);
      expect(plan.skippedNegativeQuantityRows).toBe(1);
      expect(plan.skippedZeroQuantityRows).toBe(1);

      const warningCodes = plan.preview.warnings.map((w) => w.code);
      expect(warningCodes).toContain('NEGATIVE_QUANTITY_ROWS_SKIPPED_ON_APPLY');
      expect(warningCodes).toContain('ZERO_QUANTITY_ROWS_SKIPPED_ON_APPLY');
      expect(warningCodes).toContain('APPLIED_TOTAL_DIFFERS_FROM_RAW_TOTAL');
    });

    it('G2: only negative group — skipped entirely, no item emitted', () => {
      const result = parseManualShiftMonthlyPreview(buildInput([
        {
          rowIndex: 2,
          distributionDateRaw: '14.6.26',
          rawDistributionValue: 'עמקים/נקודה א',
          customerName: 'לקוח א',
          orderNumber: 'SO-1',
          sku: '1001',
          quantity: -5
        }
      ]));

      expect(result.preview.totals).toMatchObject({
        rawTotalQuantity: -5,
        positiveTotalQuantity: 0,
        negativeTotalQuantity: -5,
        positiveQuantityRowsCount: 0,
        negativeQuantityRowsCount: 1,
        zeroQuantityRowsCount: 0
      });

      const plan = planManualShiftMonthlyImportApply(result);
      expect(plan.appliedTotalQuantity).toBe(0);
      expect(plan.appliedItemLines).toBe(0);
      expect(plan.appliedGroups).toBe(0);
      expect(plan.skippedGroups).toBe(1);
      expect(plan.lines).toEqual([]);
    });

    it('G3: mixed positive and negative same SKU — applies only positive rows', () => {
      const result = parseManualShiftMonthlyPreview(buildInput([
        {
          rowIndex: 2,
          distributionDateRaw: '14.6.26',
          rawDistributionValue: 'עמקים/נקודה א',
          customerName: 'לקוח א',
          orderNumber: 'SO-1',
          sku: '1001',
          quantity: 10
        },
        {
          rowIndex: 3,
          distributionDateRaw: '14.6.26',
          rawDistributionValue: 'עמקים/נקודה א',
          customerName: 'לקוח א',
          orderNumber: 'SO-1',
          sku: '1001',
          quantity: -2
        }
      ]));

      expect(result.preview.totals).toMatchObject({
        rawTotalQuantity: 8,
        positiveTotalQuantity: 10,
        negativeTotalQuantity: -2,
        positiveQuantityRowsCount: 1,
        negativeQuantityRowsCount: 1,
        zeroQuantityRowsCount: 0
      });

      const plan = planManualShiftMonthlyImportApply(result);
      expect(plan.appliedTotalQuantity).toBe(10);
      expect(plan.appliedItemLines).toBe(1);
      expect(plan.appliedGroups).toBe(1);
      expect(plan.skippedGroups).toBe(0);
      expect(plan.skippedNegativeQuantityRows).toBe(1);
      expect(plan.lines[0].orders[0].items[0].quantity).toBe(10);
      expect(plan.lines[0].orders[0].totalQuantity).toBe(10);

      const warningCodes = plan.preview.warnings.map((w) => w.code);
      expect(warningCodes).toContain('NEGATIVE_QUANTITY_ROWS_SKIPPED_ON_APPLY');
      expect(warningCodes).toContain('APPLIED_TOTAL_DIFFERS_FROM_RAW_TOTAL');
    });

    it('G4: duplicate positive SKU rows aggregated into single item line', () => {
      const result = parseManualShiftMonthlyPreview(buildInput([
        {
          rowIndex: 2,
          distributionDateRaw: '14.6.26',
          rawDistributionValue: 'עמקים/נקודה א',
          customerName: 'לקוח א',
          orderNumber: 'SO-1',
          sku: '1001',
          quantity: 4
        },
        {
          rowIndex: 3,
          distributionDateRaw: '14.6.26',
          rawDistributionValue: 'עמקים/נקודה א',
          customerName: 'לקוח א',
          orderNumber: 'SO-1',
          sku: '1001',
          quantity: 6
        }
      ]));

      expect(result.preview.totals).toMatchObject({
        rawTotalQuantity: 10,
        positiveTotalQuantity: 10,
        negativeTotalQuantity: 0,
        positiveQuantityRowsCount: 2,
        zeroQuantityRowsCount: 0
      });
      expect(result.preview.totals.aggregatedSkuGroups).toBe(1);

      const plan = planManualShiftMonthlyImportApply(result);
      expect(plan.appliedTotalQuantity).toBe(10);
      expect(plan.appliedItemLines).toBe(1);
      expect(plan.lines[0].orders[0].items).toHaveLength(1);
      expect(plan.lines[0].orders[0].items[0].quantity).toBe(10);
      expect(plan.lines[0].orders[0].items[0].sourceRows).toEqual([2, 3]);

      const warningCodes = plan.preview.warnings.map((w) => w.code);
      expect(warningCodes).toContain('DUPLICATE_SKU_ROWS_AGGREGATED');
    });

    it('G5: real-date style smoke — quantity accounting with normal preview/apply path', () => {
      const result = parseManualShiftMonthlyPreview(buildInput([
        {
          rowIndex: 2,
          distributionDateRaw: '3.6.26',
          rawDistributionValue: 'צפון/סלולר',
          customerName: 'לקוח א',
          orderNumber: 'SO-1',
          sku: '1001',
          quantity: 7,
          zone: 'צפון'
        },
        {
          rowIndex: 3,
          distributionDateRaw: '3.6.26',
          rawDistributionValue: 'צפון/סלולר',
          customerName: 'לקוח א',
          orderNumber: 'SO-1',
          sku: '1001',
          quantity: 3,
          zone: 'צפון'
        },
        {
          rowIndex: 4,
          distributionDateRaw: '3.6.26',
          rawDistributionValue: 'צפון/סלולר',
          customerName: 'לקוח א',
          orderNumber: 'SO-2',
          sku: '1002',
          quantity: -1,
          zone: 'צפון'
        },
        {
          rowIndex: 5,
          distributionDateRaw: '3.6.26',
          rawDistributionValue: 'צפון/סלולר',
          customerName: 'לקוח א',
          orderNumber: 'SO-3',
          sku: '1003',
          quantity: 0,
          zone: 'צפון'
        }
      ], '2026-06-03'));

      expect(result.preview.dateSummary.matchingRows).toBe(4);
      expect(result.preview.totals).toMatchObject({
        rawTotalQuantity: 9,
        positiveTotalQuantity: 10,
        negativeTotalQuantity: -1,
        positiveQuantityRowsCount: 2,
        negativeQuantityRowsCount: 1,
        zeroQuantityRowsCount: 1
      });
      expect(result.groups).toHaveLength(3);

      const plan = planManualShiftMonthlyImportApply(result);
      expect(plan.appliedTotalQuantity).toBe(10);
      expect(plan.appliedItemLines).toBe(1);
      expect(plan.skippedGroups).toBe(2);

      const warningCodes = plan.preview.warnings.map((w) => w.code);
      expect(warningCodes).toContain('NEGATIVE_QUANTITY_ROWS_SKIPPED_ON_APPLY');
      expect(warningCodes).toContain('ZERO_QUANTITY_ROWS_SKIPPED_ON_APPLY');
      expect(warningCodes).toContain('APPLIED_TOTAL_DIFFERS_FROM_RAW_TOTAL');
      expect(warningCodes).toContain('DUPLICATE_SKU_ROWS_AGGREGATED');
    });
  });

  it('C(e): regression — legacy lineName/pointName fallback still works and all PR A/PR B assertions hold', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'עמקים/נקודה א',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1001',
        description: 'מוצר א',
        category: 'cat',
        quantity: 2,
        notes: 'איסוף',
        zone: 'north'
      },
      {
        rowIndex: 3,
        distributionDateRaw: '14.06.26',
        rawDistributionValue: 'עמקים/נקודה א',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1001',
        description: 'מוצר א',
        category: 'cat',
        quantity: 3,
        notes: 'איסוף',
        zone: 'north'
      }
    ]));

    expect(result.preview.selectedDate).toEqual({ raw: '14.06.26', normalized: '2026-06-14' });
    expect(result.preview.totals).toMatchObject({
      lines: 1,
      rawDistributionValues: 1,
      derivedPoints: 1,
      rawTotalQuantity: 5,
      positiveTotalQuantity: 5,
      negativeTotalQuantity: 0,
      zeroQuantityRowsCount: 0,
      negativeQuantityRowsCount: 0,
      positiveQuantityRowsCount: 2
    });
    expect(result.groups).toEqual([
      expect.objectContaining({
        lineName: 'עמקים',
        pointName: 'נקודה א',
        totalQuantity: 5,
        sourceRows: [2, 3],
        notes: ['איסוף'],
        rawRouteLine: 'עמקים/נקודה א',
        routeBase: 'עמקים',
        workBucketName: 'נקודה א',
        workBucketType: 'unknown'
      })
    ]);
  });

  // ── Special-flow exclusion tests ───────────────────────────────────────────

  it('excludes pure special-flow SO (איסוף) from normal import, group skipped', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/סלולר',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 5,
        notes: 'איסוף'
      }
    ]));
    const plan = planManualShiftMonthlyImportApply(result);

    expect(plan.appliedGroups).toBe(0);
    expect(plan.skippedGroups).toBe(1);
    expect(plan.lines).toHaveLength(0);
    expect(result.preview.anomalies.specialFlowRowCount).toBe(1);

    const warningCodes = plan.preview.warnings.map((w) => w.code);
    expect(warningCodes).toContain('SPECIAL_FLOW_ROW_EXCLUDED_FROM_DISTRIBUTION_IMPORT');
  });

  it('excludes pure special-flow SO (сбор, Russian) from normal import', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/סלולר',
        customerName: 'לקוח ר',
        orderNumber: 'SO-5',
        sku: '2001',
        quantity: 3,
        notes: 'сбор'
      }
    ]));
    const plan = planManualShiftMonthlyImportApply(result);

    expect(plan.appliedGroups).toBe(0);
    expect(plan.skippedGroups).toBe(1);

    const warningCodes = plan.preview.warnings.map((w) => w.code);
    expect(warningCodes).toContain('SPECIAL_FLOW_ROW_EXCLUDED_FROM_DISTRIBUTION_IMPORT');
  });

  it('excludes pure special-flow SO (החזרה / return) from normal import', () => {
    const resultHebrew = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/סלולר',
        customerName: 'לקוח',
        orderNumber: 'SO-R1',
        sku: '3001',
        quantity: 2,
        notes: 'החזרה'
      }
    ]));
    const planHebrew = planManualShiftMonthlyImportApply(resultHebrew);
    expect(planHebrew.appliedGroups).toBe(0);

    const resultEnglish = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 3,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/סלולר',
        customerName: 'Customer',
        orderNumber: 'SO-R2',
        sku: '3002',
        quantity: 4,
        notes: 'return'
      }
    ]));
    const planEnglish = planManualShiftMonthlyImportApply(resultEnglish);
    expect(planEnglish.appliedGroups).toBe(0);

    const warningCodes = planHebrew.preview.warnings.map((w) => w.code);
    expect(warningCodes).toContain('SPECIAL_FLOW_ROW_EXCLUDED_FROM_DISTRIBUTION_IMPORT');
  });

  it('excludes pure special-flow SO (השלמה / אשלמה) from normal distribution import', () => {
    const resultAshlama = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/סלולר',
        customerName: 'לקוח',
        orderNumber: 'SO-A1',
        sku: '4001',
        quantity: 1,
        notes: 'השלמה'
      }
    ]));
    const planAshlama = planManualShiftMonthlyImportApply(resultAshlama);
    expect(planAshlama.appliedGroups).toBe(0);

    const resultEshlama = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 3,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'קו דרום/סלולר',
        customerName: 'לקוח',
        orderNumber: 'SO-A2',
        sku: '4002',
        quantity: 2,
        notes: 'אשלמה'
      }
    ]));
    const planEshlama = planManualShiftMonthlyImportApply(resultEshlama);
    expect(planEshlama.appliedGroups).toBe(0);
  });

  it('positive quantity special-flow rows do not create manual_shift_order_items', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'עמקים/נקודה א',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 5,
        notes: 'איסוף'
      }
    ]));
    const plan = planManualShiftMonthlyImportApply(result);

    expect(plan.appliedGroups).toBe(0);
    expect(plan.lines).toHaveLength(0);
    expect(plan.appliedItemLines).toBe(0);
  });

  it('normal rows without special-flow markers still import correctly', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'עמקים/נקודה א',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 5
      }
    ]));
    const plan = planManualShiftMonthlyImportApply(result);

    expect(plan.appliedGroups).toBe(1);
    expect(plan.lines[0].orders[0].items[0].quantity).toBe(5);
    expect(plan.appliedItemLines).toBe(1);
    expect(result.preview.anomalies.specialFlowRowCount).toBe(0);

    const warningCodes = plan.preview.warnings.map((w) => w.code);
    expect(warningCodes).not.toContain('SPECIAL_FLOW_ROW_EXCLUDED_FROM_DISTRIBUTION_IMPORT');
  });

  it('mixed SO: normal rows import, special-flow rows excluded', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'עמקים/נקודה א',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1001',
        quantity: 5,
        notes: 'normal item'
      },
      {
        rowIndex: 3,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'עמקים/נקודה א',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1002',
        quantity: 3,
        notes: 'איסוף מלקוח'
      },
      {
        rowIndex: 4,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'עמקים/נקודה א',
        customerName: 'לקוח א',
        orderNumber: 'SO-1',
        sku: '1003',
        quantity: 2,
        notes: 'collection'
      }
    ]));
    const plan = planManualShiftMonthlyImportApply(result);

    expect(plan.appliedGroups).toBe(1);
    expect(plan.skippedGroups).toBe(2);
    expect(plan.lines[0].orders).toHaveLength(1);
    expect(plan.lines[0].orders[0].items).toHaveLength(1);
    expect(plan.lines[0].orders[0].items[0].sku).toBe('1001');
    expect(plan.lines[0].orders[0].items[0].quantity).toBe(5);
    expect(plan.appliedTotalQuantity).toBe(5);

    const warningCodes = plan.preview.warnings.map((w) => w.code);
    expect(warningCodes).toContain('SPECIAL_FLOW_ROW_EXCLUDED_FROM_DISTRIBUTION_IMPORT');
  });

  it('warning for excluded special-flow rows includes useful audit context', () => {
    const result = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'עמקים/נקודה א',
        customerName: 'לקוח א',
        orderNumber: 'SO-42',
        sku: '1001',
        quantity: 7,
        notes: 'איסוף'
      }
    ]));
    const plan = planManualShiftMonthlyImportApply(result);

    const warning = plan.preview.warnings.find(
      (w) => w.code === 'SPECIAL_FLOW_ROW_EXCLUDED_FROM_DISTRIBUTION_IMPORT'
    );
    expect(warning).toBeDefined();
    expect(warning!.count).toBe(1);
    expect(warning!.rows).toEqual([2]);
    expect(warning!.message).toContain('SO-42');
    expect(warning!.message).toContain('1001');
    expect(warning!.message).toContain('7');
    expect(warning!.message).toContain('איסוף');
  });
});
