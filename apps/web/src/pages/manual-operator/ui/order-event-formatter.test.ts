import { describe, expect, it } from 'vitest';
import type { ManualShiftOrderEvent } from '@wos/domain';
import { formatOrderEventLabel } from './order-event-formatter';

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

describe('formatOrderEventLabel', () => {
  it('created → הזמנה נוצרה', () => {
    expect(formatOrderEventLabel(makeEvent({ eventType: 'created' }))).toBe('הזמנה נוצרה');
  });

  it('status_changed with toStatus → shows Hebrew label', () => {
    expect(
      formatOrderEventLabel(makeEvent({ eventType: 'status_changed', toStatus: 'picking' }))
    ).toBe('סטטוס שונה ל: בליקוט');
  });

  it('status_changed waiting_check', () => {
    expect(
      formatOrderEventLabel(makeEvent({ eventType: 'status_changed', toStatus: 'waiting_check' }))
    ).toBe('סטטוס שונה ל: ממתין לבדיקה');
  });

  it('status_changed done', () => {
    expect(
      formatOrderEventLabel(makeEvent({ eventType: 'status_changed', toStatus: 'done' }))
    ).toBe('סטטוס שונה ל: הושלם');
  });

  it('error_reported → תקלה דווחה', () => {
    expect(formatOrderEventLabel(makeEvent({ eventType: 'error_reported' }))).toBe('תקלה דווחה');
  });

  it('picker_changed → מלקט שונה', () => {
    expect(formatOrderEventLabel(makeEvent({ eventType: 'picker_changed' }))).toBe('מלקט שונה');
  });

  it('check_unit_created → יחידת בדיקה נוספה', () => {
    expect(formatOrderEventLabel(makeEvent({ eventType: 'check_unit_created' }))).toBe('יחידת בדיקה נוספה');
  });

  it('check_unit_status_changed → סטטוס יחידת בדיקה עודכן', () => {
    expect(formatOrderEventLabel(makeEvent({ eventType: 'check_unit_status_changed' }))).toBe('סטטוס יחידת בדיקה עודכן');
  });

  it('check_unit_note_changed → הערה ביחידת בדיקה עודכנה', () => {
    expect(formatOrderEventLabel(makeEvent({ eventType: 'check_unit_note_changed' }))).toBe('הערה ביחידת בדיקה עודכנה');
  });

  it('ashlama_created → השלמה נפתחה', () => {
    expect(formatOrderEventLabel(makeEvent({ eventType: 'ashlama_created' }))).toBe('השלמה נפתחה');
  });

  it('ashlama_status_changed done → השלמה סומנה כבוצעה', () => {
    expect(
      formatOrderEventLabel(
        makeEvent({ eventType: 'ashlama_status_changed', payload: { toStatus: 'done' } })
      )
    ).toBe('השלמה סומנה כבוצעה');
  });

  it('ashlama_status_changed cancelled → השלמה בוטלה', () => {
    expect(
      formatOrderEventLabel(
        makeEvent({ eventType: 'ashlama_status_changed', payload: { toStatus: 'cancelled' } })
      )
    ).toBe('השלמה בוטלה');
  });

  it('unknown event type uses fallback', () => {
    expect(
      formatOrderEventLabel(makeEvent({ eventType: 'updated' as ManualShiftOrderEvent['eventType'] }))
    ).toBe('עודכן מידע בהזמנה');
  });
});
