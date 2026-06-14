import { describe, expect, it } from 'vitest';
import {
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
      totalQuantity: 5
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

  it('uses customer fallback point when distribution value has no slash', () => {
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
    expect(result.preview.anomalies.pointFallbackRows).toBe(1);
    expect(result.groups[0]?.pointName).toBe('לקוח fallback');
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
      'NON_SO_ORDER_ROWS'
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

  it('plans apply only positive source rows when a grouped sku mixes positive, negative, and zero rows', () => {
    const preview = parseManualShiftMonthlyPreview(buildInput([
      {
        rowIndex: 2,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'ЧўЧћЧ§Ч™Чќ/Ч Ч§Ч•Ч“Ч” Чђ',
        customerName: 'ЧњЧ§Ч•Ч— Чђ',
        orderNumber: 'SO-1',
        sku: '1001',
        description: 'ЧћЧ•Ч¦ЧЁ Чђ',
        category: 'cat',
        quantity: 5,
        notes: 'first'
      },
      {
        rowIndex: 3,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'ЧўЧћЧ§Ч™Чќ/Ч Ч§Ч•Ч“Ч” Чђ',
        customerName: 'ЧњЧ§Ч•Ч— Чђ',
        orderNumber: 'SO-1',
        sku: '1001',
        description: 'ЧћЧ•Ч¦ЧЁ Чђ',
        category: 'cat',
        quantity: -1,
        notes: 'second'
      },
      {
        rowIndex: 4,
        distributionDateRaw: '14.6.26',
        rawDistributionValue: 'ЧўЧћЧ§Ч™Чќ/Ч Ч§Ч•Ч“Ч” Ч‘',
        customerName: 'ЧњЧ§Ч•Ч— Ч‘',
        orderNumber: 'SO-2',
        sku: '1002',
        description: 'ЧћЧ•Ч¦ЧЁ Ч‘',
        category: 'cat',
        quantity: 0
      }
    ]));

    const plan = planManualShiftMonthlyImportApply(preview);

    expect(plan.skippedGroups).toBe(1);
    expect(plan.skippedNegativeQuantityRows).toBe(1);
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
});
