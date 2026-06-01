import { describe, expect, it } from 'vitest';
import type { ManualShiftOrderEvent } from '@wos/domain';
import { formatOrderEvent } from './order-event-formatter';

function makeEvent(overrides: Partial<ManualShiftOrderEvent> = {}): ManualShiftOrderEvent {
  return {
    id: 'e1111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    shiftId: '33333333-3333-4333-8333-333333333333',
    lineId: '44444444-4444-4444-8444-444444444444',
    orderId: '55555555-5555-4555-8555-555555555555',
    eventType: 'created',
    actorName: 'Dispatcher',
    actorProfileId: null,
    fromStatus: null,
    toStatus: null,
    payload: null,
    createdAt: '2026-05-26T07:00:00.000Z',
    ...overrides
  };
}

describe('formatOrderEvent', () => {
  it('1. queued -> picking', () => {
    const r = formatOrderEvent(makeEvent({ eventType: 'status_changed', fromStatus: 'queued', toStatus: 'picking' }));
    expect(r.label).toBe('הליקוט התחיל');
  });

  it('2. picking -> waiting_check', () => {
    const r = formatOrderEvent(makeEvent({ eventType: 'status_changed', fromStatus: 'picking', toStatus: 'waiting_check' }));
    expect(r.label).toBe('הליקוט הושלם');
    expect(r.detail).toBe('ההזמנה ממתינה לבדיקה');
  });

  it('3. waiting_check -> returned', () => {
    const r = formatOrderEvent(makeEvent({ eventType: 'status_changed', fromStatus: 'waiting_check', toStatus: 'returned' }));
    expect(r.label).toBe('ההזמנה הוחזרה לתיקון');
  });

  it('4. returned -> waiting_check', () => {
    const r = formatOrderEvent(makeEvent({ eventType: 'status_changed', fromStatus: 'returned', toStatus: 'waiting_check' }));
    expect(r.label).toBe('ההזמנה נשלחה לבדיקה חוזרת');
  });

  it('5. waiting_check -> done', () => {
    const r = formatOrderEvent(makeEvent({ eventType: 'status_changed', fromStatus: 'waiting_check', toStatus: 'done' }));
    expect(r.label).toBe('ההזמנה נסגרה');
  });

  it('6. unknown status transition fallback', () => {
    const r = formatOrderEvent(makeEvent({ eventType: 'status_changed', fromStatus: 'queued', toStatus: 'done' }));
    expect(r.label).toBe('סטטוס הזמנה השתנה');
    expect(r.detail).toBe('ממתין -> הושלם');
  });

  it('7. initial picker assignment', () => {
    const r = formatOrderEvent(makeEvent({ eventType: 'picker_changed', payload: { previousPickerName: null, nextPickerName: 'Dana' } }));
    expect(r.label).toBe('מונה מלקט: Dana');
  });

  it('8. picker replacement', () => {
    const r = formatOrderEvent(makeEvent({ eventType: 'picker_changed', payload: { previousPickerName: 'Dana', nextPickerName: 'Alex' } }));
    expect(r.label).toBe('המלקט הוחלף: Dana -> Alex');
  });

  it('9. check-unit created with unit number', () => {
    const r = formatOrderEvent(makeEvent({ eventType: 'check_unit_created', payload: { unitNumber: 3 } }));
    expect(r.label).toBe('נוספה יחידת בדיקה 3');
  });

  it('10. check-unit checked', () => {
    const r = formatOrderEvent(makeEvent({ eventType: 'check_unit_status_changed', payload: { unitNumber: 2, fromStatus: 'open', toStatus: 'checked' } }));
    expect(r.label).toBe('יחידת בדיקה 2: פתוח -> נבדק');
  });

  it('11. check-unit returned with reason', () => {
    const r = formatOrderEvent(makeEvent({ eventType: 'check_unit_status_changed', payload: { unitNumber: 2, fromStatus: 'checked', toStatus: 'returned', reason: 'wrong item' } }));
    expect(r.label).toBe('יחידת בדיקה 2: נבדק -> הוחזר לתיקון');
    expect(r.detail).toBe('סיבה: wrong item');
  });

  it('12. check-unit reopened', () => {
    const r = formatOrderEvent(makeEvent({ eventType: 'check_unit_status_changed', payload: { unitNumber: 2, fromStatus: 'returned', toStatus: 'open' } }));
    expect(r.label).toBe('יחידת בדיקה 2: הוחזר לתיקון -> פתוח');
  });

  it('13. check-unit voided', () => {
    const r = formatOrderEvent(makeEvent({ eventType: 'check_unit_status_changed', payload: { unitNumber: 2, fromStatus: 'open', toStatus: 'voided' } }));
    expect(r.label).toBe('יחידת בדיקה 2: פתוח -> בוטל');
  });

  it('14. note/reason changed', () => {
    const r = formatOrderEvent(makeEvent({ eventType: 'check_unit_note_changed', payload: { unitNumber: 8, note: 'fixed', reason: 'missing item' } }));
    expect(r.label).toBe('עודכנה הערה ליחידת בדיקה 8');
    expect(r.detail).toContain('הערה: fixed');
    expect(r.detail).toContain('סיבה: missing item');
  });

  it('15. ashlama created', () => {
    const r = formatOrderEvent(makeEvent({ eventType: 'ashlama_created', payload: { checkUnitId: 'abc', text: 'complete pack' } }));
    expect(r.label).toBe('נפתחה השלמה ליחידת בדיקה');
    expect(r.detail).toBe('complete pack');
  });

  it('16. error reported with comment', () => {
    const r = formatOrderEvent(makeEvent({ eventType: 'error_reported', payload: { type: 'wrong_item', comment: 'sku mismatch' } }));
    expect(r.label).toBe('דווחה תקלה בהזמנה');
    expect(r.detail).toContain('wrong_item');
    expect(r.detail).toContain('sku mismatch');
  });

  it('17. bulk imported', () => {
    const r = formatOrderEvent(makeEvent({ eventType: 'bulk_imported', payload: { raw: 'row text' } }));
    expect(r.label).toBe('הזמנה נוספה מייבוא מרובה');
    expect(r.isVisible).toBe(false);
  });

  it('18. deleted', () => {
    const r = formatOrderEvent(makeEvent({ eventType: 'point_deleted', payload: { reason: 'duplicate' } }));
    expect(r.label).toBe('ההזמנה נמחקה');
    expect(r.detail).toBe('duplicate');
  });

  it('19. restored', () => {
    const r = formatOrderEvent(makeEvent({ eventType: 'point_restored', payload: { reason: 'mistake' } }));
    expect(r.label).toBe('ההזמנה שוחזרה');
    expect(r.detail).toBe('mistake');
  });

  it('20. generic updated noise handling', () => {
    const noisy = formatOrderEvent(makeEvent({ eventType: 'updated', payload: null }));
    expect(noisy.isVisible).toBe(false);

    const meaningful = formatOrderEvent(makeEvent({ eventType: 'updated', payload: { pointName: 'X', comment: 'Y' } }));
    expect(meaningful.isVisible).toBe(false);
  });
});
