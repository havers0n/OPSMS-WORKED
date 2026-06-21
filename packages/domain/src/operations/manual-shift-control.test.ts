import { describe, expect, it } from 'vitest';
import {
  buildOrderStatusBreakdown,
  calculateSizeFromLineCount,
  canTransitionManualShiftOrderToDoneWithCheckUnits,
  canTransitionManualShiftOrderStatus,
  deriveManualShiftLineStatus,
  getEffectiveExpectedCheckUnitsCount,
  manualShiftBulkAddResultSchema,
  manualShiftDaySummarySchema,
  manualShiftOrderCheckUnitSchema,
  manualShiftOrderItemSchema,
  manualShiftOrderSchema,
  bucketProductRollupResponseSchema,
  manualShiftWorkHierarchyResponseSchema,
  manualShiftWorkHierarchyRouteGroupSchema,
  manualShiftWorkHierarchyWorkBucketSchema,
  summarizeManualShiftOrderCheckUnits,
  manualShiftTodayResponseSchema
} from './manual-shift-control';

describe('manual shift control contracts', () => {
  it('accepts only allowed manual order transitions', () => {
    expect(canTransitionManualShiftOrderStatus('queued', 'picking')).toBe(true);
    expect(canTransitionManualShiftOrderStatus('picking', 'waiting_check')).toBe(true);
    expect(canTransitionManualShiftOrderStatus('waiting_check', 'done')).toBe(true);
    expect(canTransitionManualShiftOrderStatus('waiting_check', 'returned')).toBe(true);
    expect(canTransitionManualShiftOrderStatus('returned', 'waiting_check')).toBe(true);
  });

  it('accepts optional bucket product rollup scope fields', () => {
    expect(
      bucketProductRollupResponseSchema.parse({
        shiftId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        lineId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        bucketName: 'סיגריות-מנטה עין המפרץ',
        sourceZone: 'גליל',
        workBucketName: 'סיגריות-מנטה עין המפרץ',
        sourceLineName: 'גליל',
        products: []
      })
    ).toMatchObject({
      bucketName: 'סיגריות-מנטה עין המפרץ',
      workBucketName: 'סיגריות-מנטה עין המפרץ',
      sourceLineName: 'גליל'
    });
  });

  it('rejects invalid manual order transitions', () => {
    expect(canTransitionManualShiftOrderStatus('queued', 'done')).toBe(false);
    expect(canTransitionManualShiftOrderStatus('returned', 'done')).toBe(false);
    expect(canTransitionManualShiftOrderStatus('done', 'waiting_check')).toBe(false);
  });

  it('calculates order size from line count', () => {
    expect(calculateSizeFromLineCount(1)).toBe('S');
    expect(calculateSizeFromLineCount(3)).toBe('S');
    expect(calculateSizeFromLineCount(4)).toBe('M');
    expect(calculateSizeFromLineCount(8)).toBe('M');
    expect(calculateSizeFromLineCount(9)).toBe('L');
    expect(calculateSizeFromLineCount(20)).toBe('L');
    expect(calculateSizeFromLineCount(21)).toBe('XL');
    expect(calculateSizeFromLineCount(undefined)).toBe('unknown');
    expect(calculateSizeFromLineCount(null)).toBe('unknown');
    expect(calculateSizeFromLineCount(0)).toBe('unknown');
    expect(calculateSizeFromLineCount(-1)).toBe('unknown');
    expect(calculateSizeFromLineCount(Number.NaN)).toBe('unknown');
  });

  it('derives line status from contained orders', () => {
    expect(deriveManualShiftLineStatus([])).toBe('open');
    expect(
      deriveManualShiftLineStatus([{ status: 'queued' }, { status: 'queued' }])
    ).toBe('open');
    expect(
      deriveManualShiftLineStatus([{ status: 'queued' }, { status: 'done' }])
    ).toBe('in_progress');
    expect(
      deriveManualShiftLineStatus([{ status: 'done' }, { status: 'done' }])
    ).toBe('done');
  });

  it('parses manual shift order schema', () => {
    expect(
      manualShiftOrderSchema.parse({
        id: 'a89d5d4a-5f0c-44a7-b75f-eaf3138fbfbf',
        tenantId: '4caa9e8d-4349-4623-ad98-9e2f2af193c0',
        shiftId: '1e4a2d96-cd70-4881-a73e-aa0c086a9bc8',
        lineId: '945e796c-1fd6-471d-8992-a7810fd3567f',
        orderNumber: '502481',
        customerName: null,
        pointName: 'ירושלים',
        palletCount: 2,
        pickerName: 'יהודה',
        pickerWorkerId: null,
        checkerName: null,
        lineCount: 12,
        size: 'L',
        status: 'queued',
        startedAt: null,
        checkStartedAt: null,
        waitingCheckAt: null,
        checkedAt: null,
        finishedAt: null,
        comment: null,
        createdAt: '2026-05-26T10:00:00.000Z',
        updatedAt: '2026-05-26T10:00:00.000Z',
        deletedAt: null,
        deletedByProfileId: null,
        deletedByName: null,
        deleteReason: null
      })
    ).toMatchObject({
      orderNumber: '502481',
      pointName: 'ירושלים',
      palletCount: 2,
      size: 'L',
      pickerName: 'יהודה'
    });
  });

  it('parses today shift response schema', () => {
    expect(
      manualShiftTodayResponseSchema.parse({
        shift: {
          id: 'a89d5d4a-5f0c-44a7-b75f-eaf3138fbfbf',
          tenantId: '4caa9e8d-4349-4623-ad98-9e2f2af193c0',
          date: '2026-05-26',
          name: 'Morning Shift',
          status: 'active',
          createdBy: 'dispatcher',
          createdAt: '2026-05-26T06:00:00.000Z',
          closedAt: null
        },
        lines: [
          {
            line: {
              id: '1e4a2d96-cd70-4881-a73e-aa0c086a9bc8',
              tenantId: '4caa9e8d-4349-4623-ad98-9e2f2af193c0',
              shiftId: 'a89d5d4a-5f0c-44a7-b75f-eaf3138fbfbf',
              name: 'שרון דרומי',
              distributionArea: null,
              sortOrder: 1,
              status: 'in_progress',
              createdAt: '2026-05-26T06:10:00.000Z',
              deletedAt: null,
              deletedByProfileId: null,
              deletedByName: null,
              deleteReason: null
            },
            totalOrders: 4,
            queuedOrders: 1,
            pickingOrders: 1,
            waitingCheckOrders: 1,
            returnedOrders: 1,
            doneOrders: 0,
            errorCount: 1
          }
        ]
      })
    ).toMatchObject({
      shift: { status: 'active' },
      lines: [{ totalOrders: 4 }]
    });
  });

  it('parses day summary schema', () => {
    expect(
      manualShiftDaySummarySchema.parse({
        shiftId: 'a89d5d4a-5f0c-44a7-b75f-eaf3138fbfbf',
        totalOrders: 8,
        queuedOrders: 1,
        pickingOrders: 2,
        waitingCheckOrders: 1,
        returnedOrders: 1,
        doneOrders: 3,
        errorsCount: 2,
        byErrorType: [{ type: 'missing_item', count: 2 }],
        byLine: [],
        byPicker: [
          {
            pickerName: 'רפאל',
            totalOrders: 3,
            queuedOrders: 0,
            pickingOrders: 1,
            waitingCheckOrders: 0,
            returnedOrders: 1,
            doneOrders: 1,
            errorCount: 1
          }
        ]
      })
    ).toMatchObject({
      totalOrders: 8,
      byErrorType: [{ type: 'missing_item' }]
    });
  });

  it('parses bulk add result schema', () => {
    expect(
      manualShiftBulkAddResultSchema.parse({
        createdCount: 2,
        rows: [
          {
            raw: 'ירושלים, יהודה, 3',
            pointName: 'ירושלים',
            orderNumber: null,
            pickerName: 'יהודה',
            lineCount: 3,
            palletCount: null,
            size: 'S'
          }
        ],
        skippedRows: ['bad row']
      })
    ).toMatchObject({
      createdCount: 2,
      rows: [{ pointName: 'ירושלים', orderNumber: null, size: 'S' }]
    });
  });
  it('parses manual shift order check unit schema', () => {
    expect(
      manualShiftOrderCheckUnitSchema.parse({
        id: 'f9f0bdee-4aeb-4c8a-a6f2-42f71e7f7e57',
        tenantId: '4caa9e8d-4349-4623-ad98-9e2f2af193c0',
        shiftId: '1e4a2d96-cd70-4881-a73e-aa0c086a9bc8',
        lineId: '945e796c-1fd6-471d-8992-a7810fd3567f',
        orderId: 'a89d5d4a-5f0c-44a7-b75f-eaf3138fbfbf',
        unitNumber: 2,
        status: 'open',
        note: null,
        reason: null,
        checkedAt: null,
        returnedAt: null,
        voidedAt: null,
        createdAt: '2026-05-26T10:00:00.000Z',
        updatedAt: '2026-05-26T10:00:00.000Z'
      })
    ).toMatchObject({
      unitNumber: 2,
      status: 'open'
    });
  });

  it('summarizes order check unit progress', () => {
    const progress = summarizeManualShiftOrderCheckUnits([
      { status: 'checked' },
      { status: 'open' },
      { status: 'returned' },
      { status: 'voided' }
    ]);

    expect(progress).toEqual({
      totalUnits: 4,
      activeUnits: 3,
      checkedUnits: 1,
      openUnits: 1,
      returnedUnits: 1,
      voidedUnits: 1,
      physicallyChecked: false,
      partiallyChecked: true
    });
  });

  it('blocks done transition when expected count is missing', () => {
    expect(canTransitionManualShiftOrderToDoneWithCheckUnits([], null)).toBe(false);
    expect(canTransitionManualShiftOrderToDoneWithCheckUnits([{ status: 'checked' }], undefined)).toBe(false);
  });

  it('blocks done when active units include open or returned', () => {
    expect(
      canTransitionManualShiftOrderToDoneWithCheckUnits([
        { status: 'checked' },
        { status: 'open' }
      ], 2)
    ).toBe(false);
    expect(
      canTransitionManualShiftOrderToDoneWithCheckUnits([
        { status: 'returned' }
      ], 1)
    ).toBe(false);
  });

  it('allows done when expected units are all checked and no open/returned', () => {
    expect(
      canTransitionManualShiftOrderToDoneWithCheckUnits([
        { status: 'checked' },
        { status: 'checked' },
        { status: 'voided' }
      ], 2)
    ).toBe(true);
  });

  it('does not treat only-voided units as physically checked', () => {
    const progress = summarizeManualShiftOrderCheckUnits([
      { status: 'voided' },
      { status: 'voided' }
    ]);
    expect(progress.physicallyChecked).toBe(false);
    expect(canTransitionManualShiftOrderToDoneWithCheckUnits([{ status: 'voided' }], 1)).toBe(false);
  });

  it('blocks done when declared expected count is above checked units', () => {
    expect(
      canTransitionManualShiftOrderToDoneWithCheckUnits([
        { status: 'checked' }
      ], 2)
    ).toBe(false);
  });

  it('derives effective expected count as max(declared, open+checked)', () => {
    expect(
      getEffectiveExpectedCheckUnitsCount({
        declaredPalletCount: null,
        units: [{ status: 'open' }, { status: 'checked' }, { status: 'returned' }, { status: 'voided' }]
      })
    ).toBe(2);
    expect(
      getEffectiveExpectedCheckUnitsCount({
        declaredPalletCount: 3,
        units: [{ status: 'checked' }]
      })
    ).toBe(3);
  });
});

describe('manual shift work hierarchy schemas', () => {
  it('parses a valid hierarchy response', () => {
    const result = manualShiftWorkHierarchyResponseSchema.parse({
      shiftId: '33333333-3333-4333-8333-333333333333',
      areas: [
        {
          areaName: 'דרום',
          displayName: 'דרום',
          totalLines: 1,
          totalBuckets: 2,
          totalOrders: 3,
          totalQuantity: 42,
          statusBreakdown: {
            queued: 1,
            picking: 1,
            waitingCheck: 1,
            returned: 0,
            done: 0
          },
          lines: [
            {
              lineId: '44444444-4444-4444-8444-444444444444',
              lineGroupName: 'קו דרום',
              distributionArea: 'דרום',
              status: 'in_progress',
              totalBuckets: 2,
              totalOrders: 3,
              totalQuantity: 42,
              statusBreakdown: {
                queued: 1,
                picking: 1,
                waitingCheck: 1,
                returned: 0,
                done: 0
              },
              buckets: [
                {
                  bucketName: 'סלולר',
                  displayName: 'סלולר',
                  totalOrders: 2,
                  totalQuantity: 30,
                  statusBreakdown: {
                    queued: 1,
                    picking: 0,
                    waitingCheck: 1,
                    returned: 0,
                    done: 0
                  },
                  orders: [
                    {
                      orderId: '55555555-5555-4555-8555-555555555555',
                      orderNumber: 'SO-1',
                      customerName: 'לקוח א',
                      pointName: 'סלולר',
                      status: 'queued',
                      lineCount: 2,
                      totalQuantity: 10,
                      hasAshlama: false,
                      hasCheckUnits: true
                    },
                    {
                      orderId: '55555555-5555-4555-8555-555555555556',
                      orderNumber: 'SO-2',
                      customerName: 'לקוח ב',
                      pointName: 'סלולר',
                      status: 'waiting_check',
                      lineCount: 3,
                      totalQuantity: 20,
                      hasAshlama: true,
                      hasCheckUnits: false
                    }
                  ]
                },
                {
                  bucketName: 'פז השקמה',
                  displayName: 'פז השקמה',
                  totalOrders: 1,
                  totalQuantity: 12,
                  statusBreakdown: {
                    queued: 0,
                    picking: 1,
                    waitingCheck: 0,
                    returned: 0,
                    done: 0
                  },
                  orders: [
                    {
                      orderId: '55555555-5555-4555-8555-555555555557',
                      orderNumber: null,
                      customerName: null,
                      pointName: 'פז השקמה',
                      status: 'picking',
                      lineCount: 1,
                      totalQuantity: 12,
                      hasAshlama: false,
                      hasCheckUnits: false
                    }
                  ]
                }
              ],
              routeGroups: []
            }
          ]
        }
      ]
    });
    expect(result.shiftId).toBe('33333333-3333-4333-8333-333333333333');
    expect(result.areas).toHaveLength(1);
    expect(result.areas[0].lines[0].buckets).toHaveLength(2);
  });

  it('accepts null areaName and null bucketName with fallback displayNames', () => {
    const result = manualShiftWorkHierarchyResponseSchema.parse({
      shiftId: '33333333-3333-4333-8333-333333333333',
      areas: [
        {
          areaName: null,
          displayName: 'ללא איזור',
          totalLines: 1,
          totalBuckets: 1,
          totalOrders: 1,
          totalQuantity: 5,
          statusBreakdown: {
            queued: 1,
            picking: 0,
            waitingCheck: 0,
            returned: 0,
            done: 0
          },
          lines: [
            {
              lineId: '44444444-4444-4444-8444-444444444444',
              lineGroupName: 'מרכז',
              distributionArea: null,
              status: 'open',
              totalBuckets: 1,
              totalOrders: 1,
              totalQuantity: 5,
              statusBreakdown: {
                queued: 1,
                picking: 0,
                waitingCheck: 0,
                returned: 0,
                done: 0
              },
              buckets: [
                {
                  bucketName: null,
                  displayName: 'קו ראשי',
                  totalOrders: 1,
                  totalQuantity: 5,
                  statusBreakdown: {
                    queued: 1,
                    picking: 0,
                    waitingCheck: 0,
                    returned: 0,
                    done: 0
                  },
                  orders: [
                    {
                      orderId: '55555555-5555-4555-8555-555555555558',
                      orderNumber: 'SO-3',
                      customerName: null,
                      pointName: null,
                      status: 'queued',
                      lineCount: 1,
                      totalQuantity: 5,
                      hasAshlama: false,
                      hasCheckUnits: false
                    }
                  ]
                }
              ],
              routeGroups: []
            }
          ]
        }
      ]
    });
    expect(result.areas[0].areaName).toBeNull();
    expect(result.areas[0].lines[0].buckets[0].bucketName).toBeNull();
  });

  it('validates required totals and statusBreakdown fields', () => {
    expect(() =>
      manualShiftWorkHierarchyResponseSchema.parse({
        shiftId: '33333333-3333-4333-8333-333333333333',
        areas: []
      })
    ).not.toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() =>
      manualShiftWorkHierarchyResponseSchema.parse({
        shiftId: 'not-a-uuid',
        areas: []
      })
    ).toThrow();
  });

  it('validates statusBreakdown with optional blocked field', () => {
    const result = manualShiftWorkHierarchyResponseSchema.parse({
      shiftId: '33333333-3333-4333-8333-333333333333',
      areas: [
        {
          areaName: 'דרום',
          displayName: 'דרום',
          totalLines: 0,
          totalBuckets: 0,
          totalOrders: 0,
          totalQuantity: 0,
          statusBreakdown: {
            queued: 0,
            picking: 0,
            waitingCheck: 0,
            returned: 0,
            done: 0,
            blocked: 2
          },
          lines: []
        }
      ]
    });
    expect(result.areas[0].statusBreakdown.blocked).toBe(2);
  });

  it('buildOrderStatusBreakdown computes correct counts', () => {
    const result = buildOrderStatusBreakdown([
      { status: 'queued' },
      { status: 'picking' },
      { status: 'waiting_check' },
      { status: 'returned' },
      { status: 'done' },
      { status: 'done' }
    ]);
    expect(result).toEqual({
      queued: 1,
      picking: 1,
      waitingCheck: 1,
      returned: 1,
      done: 2
    });
  });

  it('parses hierarchy response with empty routeGroups', () => {
    const result = manualShiftWorkHierarchyResponseSchema.parse({
      shiftId: '33333333-3333-4333-8333-333333333333',
      areas: [{
        areaName: 'דרום', displayName: 'דרום',
        totalLines: 1, totalBuckets: 0, totalOrders: 0, totalQuantity: 0,
        statusBreakdown: { queued: 0, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        lines: [{
          lineId: '44444444-4444-4444-8444-444444444444',
          lineGroupName: 'קו דרום', distributionArea: 'דרום', status: 'open',
          totalBuckets: 0, totalOrders: 0, totalQuantity: 0,
          statusBreakdown: { queued: 0, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          buckets: [],
          routeGroups: []
        }]
      }]
    });
    expect(result.areas[0].lines[0].routeGroups!).toEqual([]);
  });

  it('parses hierarchy response with route groups and work buckets', () => {
    const result = manualShiftWorkHierarchyResponseSchema.parse({
      shiftId: '33333333-3333-4333-8333-333333333333',
      areas: [{
        areaName: 'צפון', displayName: 'צפון',
        totalLines: 1, totalBuckets: 0, totalOrders: 0, totalQuantity: 0,
        statusBreakdown: { queued: 0, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        lines: [{
          lineId: '44444444-4444-4444-8444-444444444444',
          lineGroupName: 'גליל', distributionArea: 'צפון', status: 'open',
          totalBuckets: 0, totalOrders: 0, totalQuantity: 0,
          statusBreakdown: { queued: 0, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          buckets: [],
          routeGroups: [{
            routeGroupKey: 'rg\u0001גליל כללי',
            routeGroupName: 'גליל כללי',
            routeGroupKind: 'general',
            classificationConfidence: 'high',
            classificationReasons: ['base route with work bucket siblings'],
            orderCount: 2,
            itemLinesCount: 4,
            totalQuantity: 30,
            statusBreakdown: { queued: 1, picking: 0, waitingCheck: 1, returned: 0, done: 0 },
            workBuckets: [{
              workBucketKey: 'wb\u0001גליל כללי\u0001כללי',
              workBucketName: 'כללי',
              workBucketDisplayName: 'כללי',
              workBucketKind: 'general',
              classificationConfidence: 'high',
              classificationReasons: ['base route with work bucket siblings'],
              orderCount: 1,
              itemLinesCount: 2,
              totalQuantity: 10,
              statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              orders: [{
                orderId: '55555555-5555-4555-8555-555555555555',
                orderNumber: 'SO-1', customerName: null, pointName: null,
                status: 'queued', lineCount: 2, totalQuantity: 10,
                hasAshlama: false, hasCheckUnits: false
              }]
            }]
          }]
        }]
      }]
    });
    expect(result.areas[0].lines[0].routeGroups!).toHaveLength(1);
    expect(result.areas[0].lines[0].routeGroups![0].routeGroupName).toBe('גליל כללי');
    expect(result.areas[0].lines[0].routeGroups![0].workBuckets[0].workBucketDisplayName).toBe('כללי');
  });

  it('rejects invalid routeGroupKind in routeGroups', () => {
    expect(() => manualShiftWorkHierarchyRouteGroupSchema.parse({
      routeGroupKey: 'rg\u0001test',
      routeGroupName: 'test',
      routeGroupKind: 'invalid-kind',
      classificationConfidence: 'high',
      classificationReasons: [],
      orderCount: 0, itemLinesCount: 0, totalQuantity: 0,
      statusBreakdown: { queued: 0, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
      workBuckets: []
    })).toThrow();
  });

  it('rejects invalid workBucketKind in workBuckets', () => {
    expect(() => manualShiftWorkHierarchyWorkBucketSchema.parse({
      workBucketKey: 'wb\u0001test\u0001כללי',
      workBucketName: 'כללי',
      workBucketDisplayName: 'כללי',
      workBucketKind: 'invalid',
      classificationConfidence: 'high',
      classificationReasons: [],
      orderCount: 0, itemLinesCount: 0, totalQuantity: 0,
      statusBreakdown: { queued: 0, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
      orders: []
    })).toThrow();
  });

  it('accepts lineKind delivery_channel for Chita lines', () => {
    const result = manualShiftWorkHierarchyResponseSchema.parse({
      shiftId: '33333333-3333-4333-8333-333333333333',
      areas: [{
        areaName: 'שפלה 1', displayName: 'שפלה 1',
        totalLines: 1, totalBuckets: 0, totalOrders: 0, totalQuantity: 0,
        statusBreakdown: { queued: 0, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        lines: [{
          lineId: '44444444-4444-4444-8444-444444444444',
          lineGroupName: "צ'יטה",
          distributionArea: 'שפלה 1', status: 'open',
          lineKind: 'delivery_channel',
          totalBuckets: 0, totalOrders: 0, totalQuantity: 0,
          statusBreakdown: { queued: 0, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          buckets: []
        }]
      }]
    });
    expect(result.areas[0].lines[0].lineKind).toBe('delivery_channel');
  });

  it('defaults lineKind to undefined when omitted', () => {
    const result = manualShiftWorkHierarchyResponseSchema.parse({
      shiftId: '33333333-3333-4333-8333-333333333333',
      areas: [{
        areaName: 'גליל', displayName: 'גליל',
        totalLines: 1, totalBuckets: 0, totalOrders: 0, totalQuantity: 0,
        statusBreakdown: { queued: 0, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        lines: [{
          lineId: '44444444-4444-4444-8444-444444444444',
          lineGroupName: 'גליל',
          distributionArea: 'גליל', status: 'open',
          totalBuckets: 0, totalOrders: 0, totalQuantity: 0,
          statusBreakdown: { queued: 0, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          buckets: []
        }]
      }]
    });
    expect(result.areas[0].lines[0].lineKind).toBeUndefined();
  });

  it('rejects invalid lineKind value', () => {
    expect(() => manualShiftWorkHierarchyResponseSchema.parse({
      shiftId: '33333333-3333-4333-8333-333333333333',
      areas: [{
        areaName: 'גליל', displayName: 'גליל',
        totalLines: 1, totalBuckets: 0, totalOrders: 0, totalQuantity: 0,
        statusBreakdown: { queued: 0, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
        lines: [{
          lineId: '44444444-4444-4444-8444-444444444444',
          lineGroupName: 'גליל',
          distributionArea: 'גליל', status: 'open',
          lineKind: 'invalid',
          totalBuckets: 0, totalOrders: 0, totalQuantity: 0,
          statusBreakdown: { queued: 0, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          buckets: []
        }]
      }]
    })).toThrow();
  });
});

describe('manual shift order item schema', () => {
  const validItem = {
    id: 'c86c6e80-2c6f-4d5f-8c1c-d2d8a1e32f7c',
    tenantId: '4caa9e8d-4349-4623-ad98-9e2f2af193c0',
    shiftId: '1e4a2d96-cd70-4881-a73e-aa0c086a9bc8',
    lineId: '945e796c-1fd6-471d-8992-a7810fd3567f',
    orderId: 'a89d5d4a-5f0c-44a7-b75f-eaf3138fbfbf',
    sku: '474089',
    description: 'בידורית BEAT IT',
    category: 'חשמל',
    quantity: 2,
    notes: 'מוכן במחסן',
    zone: 'שפלה 1',
    sourceSheet: 'יוני 26',
    sourceRows: [709, 710],
    sourceFile: 'רוני קובץ 2026.xlsx',
    sortOrder: 1,
    createdAt: '2026-06-14T10:00:00.000Z'
  };

  it('parses a valid order item', () => {
    const item = manualShiftOrderItemSchema.parse(validItem);
    expect(item.sku).toBe('474089');
    expect(item.quantity).toBe(2);
    expect(item.sourceRows).toEqual([709, 710]);
  });

  it('rejects blank sku', () => {
    expect(() => manualShiftOrderItemSchema.parse({ ...validItem, sku: '' })).toThrow();
    expect(() => manualShiftOrderItemSchema.parse({ ...validItem, sku: '   ' })).toThrow();
  });

  it('accepts negative quantity', () => {
    const item = manualShiftOrderItemSchema.parse({ ...validItem, quantity: -1 });
    expect(item.quantity).toBe(-1);
  });

  it('accepts null for all nullable text fields', () => {
    const item = manualShiftOrderItemSchema.parse({
      ...validItem,
      description: null,
      category: null,
      notes: null,
      zone: null,
      sourceSheet: null,
      sourceFile: null,
      sourceRows: null
    });
    expect(item.description).toBeNull();
    expect(item.category).toBeNull();
    expect(item.notes).toBeNull();
    expect(item.zone).toBeNull();
    expect(item.sourceSheet).toBeNull();
    expect(item.sourceFile).toBeNull();
    expect(item.sourceRows).toBeNull();
  });

  it('accepts sourceRows as array of integers', () => {
    const item = manualShiftOrderItemSchema.parse({ ...validItem, sourceRows: [747, 748] });
    expect(item.sourceRows).toEqual([747, 748]);
  });
});


