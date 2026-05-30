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
      return 'מלקט שונה';
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
