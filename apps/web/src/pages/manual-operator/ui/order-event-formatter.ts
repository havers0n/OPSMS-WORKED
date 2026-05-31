import type { ManualShiftOrderEvent } from '@wos/domain';

const ORDER_STATUS_LABELS: Record<string, string> = {
  queued: 'ממתין',
  picking: 'בליקוט',
  waiting_check: 'ממתין לבדיקה',
  returned: 'הוחזר לתיקון',
  done: 'הושלם'
};

export function formatOrderEventLabel(event: ManualShiftOrderEvent): string {
  switch (event.eventType) {
    case 'created':
      return 'הזמנה נוצרה';
    case 'status_changed': {
      const to = event.toStatus ? (ORDER_STATUS_LABELS[event.toStatus] ?? event.toStatus) : '';
      return `סטטוס שונה ל: ${to}`;
    }
    case 'error_reported':
      return 'תקלה דווחה';
    case 'picker_changed':
      return '\u05DE\u05DC\u05E7\u05D8 \u05E9\u05D5\u05E0\u05D4';
    case 'check_started':
      return '\u05D4\u05D1\u05D3\u05D9\u05E7\u05D4 \u05D4\u05EA\u05D7\u05D9\u05DC\u05D4';
    case 'check_unit_created':
      return 'יחידת בדיקה נוספה';
    case 'check_unit_status_changed':
      return 'סטטוס יחידת בדיקה עודכן';
    case 'check_unit_note_changed':
      return 'הערה ביחידת בדיקה עודכנה';
    case 'ashlama_created':
      return 'השלמה נפתחה';
    case 'ashlama_status_changed': {
      const payload = event.payload as Record<string, unknown> | null;
      const toStatus = payload?.['toStatus'];
      if (toStatus === 'done') return 'השלמה סומנה כבוצעה';
      if (toStatus === 'cancelled') return 'השלמה בוטלה';
      return 'סטטוס השלמה שונה';
    }
    default:
      return 'עודכן מידע בהזמנה';
  }
}

