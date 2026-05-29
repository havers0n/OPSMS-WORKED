import { describe, expect, it } from 'vitest';
import {
  calculateSizeFromLineCount,
  canTransitionManualShiftOrderToDoneWithCheckUnits,
  canTransitionManualShiftOrderStatus,
  deriveManualShiftLineStatus,
  manualShiftBulkAddResultSchema,
  manualShiftDaySummarySchema,
  manualShiftOrderCheckUnitSchema,
  manualShiftOrderSchema,
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
});


