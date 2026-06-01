import type { ManualShiftOrderEvent } from '@wos/domain';

const ORDER_STATUS_LABELS: Record<string, string> = {
  queued: 'ממתין',
  picking: 'בליקוט',
  waiting_check: 'ממתין לבדיקה',
  returned: 'הוחזר לתיקון',
  done: 'הושלם'
};

const CHECK_UNIT_STATUS_LABELS: Record<string, string> = {
  open: 'פתוח',
  checked: 'נבדק',
  returned: 'הוחזר לתיקון',
  voided: 'בוטל'
};

export type FormattedOrderEvent = {
  label: string;
  detail: string | null;
  isVisible: boolean;
};

function asRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {};
  return payload as Record<string, unknown>;
}

function asText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function statusLabel(status: string | null | undefined): string {
  if (!status) return 'לא ידוע';
  return ORDER_STATUS_LABELS[status] ?? status;
}

function checkUnitStatusLabel(status: string | null | undefined): string {
  if (!status) return 'לא ידוע';
  return CHECK_UNIT_STATUS_LABELS[status] ?? status;
}

export function formatOrderEvent(event: ManualShiftOrderEvent): FormattedOrderEvent {
  const payload = asRecord(event.payload);

  switch (event.eventType) {
    case 'created':
      return { label: 'הזמנה נוצרה', detail: null, isVisible: true };

    case 'status_changed': {
      const from = event.fromStatus;
      const to = event.toStatus;
      if (from === 'queued' && to === 'picking') {
        return { label: 'הליקוט התחיל', detail: null, isVisible: true };
      }
      if (from === 'picking' && to === 'waiting_check') {
        return { label: 'הליקוט הושלם', detail: 'ההזמנה ממתינה לבדיקה', isVisible: true };
      }
      if (from === 'waiting_check' && to === 'returned') {
        return { label: 'ההזמנה הוחזרה לתיקון', detail: null, isVisible: true };
      }
      if (from === 'returned' && to === 'waiting_check') {
        return { label: 'ההזמנה נשלחה לבדיקה חוזרת', detail: null, isVisible: true };
      }
      if (from === 'waiting_check' && to === 'done') {
        return { label: 'ההזמנה נסגרה', detail: null, isVisible: true };
      }
      return {
        label: 'סטטוס הזמנה השתנה',
        detail: `${statusLabel(from)} -> ${statusLabel(to)}`,
        isVisible: true
      };
    }

    case 'error_reported': {
      const detail = [asText(payload['type']), asText(payload['comment'])].filter(Boolean).join(' · ') || null;
      return { label: 'דווחה תקלה בהזמנה', detail, isVisible: true };
    }

    case 'picker_changed': {
      const previousPicker = asText(payload['previousPickerName']);
      const nextPicker = asText(payload['nextPickerName']) ?? 'לא ידוע';
      if (!previousPicker) {
        return { label: `מונה מלקט: ${nextPicker}`, detail: null, isVisible: true };
      }
      return { label: `המלקט הוחלף: ${previousPicker} -> ${nextPicker}`, detail: null, isVisible: true };
    }

    case 'check_started':
      return { label: 'הבדיקה התחילה', detail: null, isVisible: true };

    case 'check_unit_created': {
      const unitNumber = typeof payload['unitNumber'] === 'number' ? payload['unitNumber'] : '-';
      return {
        label: `נוספה יחידת בדיקה ${unitNumber}`,
        detail: asText(payload['reason']) ?? asText(payload['note']),
        isVisible: true
      };
    }

    case 'check_unit_status_changed': {
      const unitNumber = typeof payload['unitNumber'] === 'number' ? payload['unitNumber'] : '-';
      const from = checkUnitStatusLabel(asText(payload['fromStatus']));
      const to = checkUnitStatusLabel(asText(payload['toStatus']));
      const reason = asText(payload['reason']);
      return {
        label: `יחידת בדיקה ${unitNumber}: ${from} -> ${to}`,
        detail: reason ? `סיבה: ${reason}` : null,
        isVisible: true
      };
    }

    case 'check_unit_note_changed': {
      const unitNumber = typeof payload['unitNumber'] === 'number' ? payload['unitNumber'] : '-';
      const note = asText(payload['note']);
      const reason = asText(payload['reason']);
      return {
        label: `עודכנה הערה ליחידת בדיקה ${unitNumber}`,
        detail: [note ? `הערה: ${note}` : null, reason ? `סיבה: ${reason}` : null]
          .filter(Boolean)
          .join(' · ') || null,
        isVisible: true
      };
    }

    case 'ashlama_created': {
      const unitNumber = typeof payload['unitNumber'] === 'number' ? payload['unitNumber'] : null;
      const checkUnitId = asText(payload['checkUnitId']);
      const unitRef = unitNumber != null ? ` ליחידת בדיקה ${unitNumber}` : checkUnitId ? ' ליחידת בדיקה' : '';
      return {
        label: `נפתחה השלמה${unitRef}`,
        detail: asText(payload['text']),
        isVisible: true
      };
    }

    case 'ashlama_status_changed': {
      const toStatus = asText(payload['toStatus']);
      const checkUnitId = asText(payload['checkUnitId']);
      const detail = checkUnitId ? `יחידת בדיקה: ${checkUnitId}` : null;
      if (toStatus === 'done') return { label: 'השלמה סומנה כבוצעה', detail, isVisible: true };
      if (toStatus === 'cancelled') return { label: 'השלמה בוטלה', detail, isVisible: true };
      return { label: 'סטטוס השלמה השתנה', detail, isVisible: true };
    }

    case 'bulk_imported':
      return { label: 'הזמנה נוספה מייבוא מרובה', detail: asText(payload['raw']), isVisible: false };

    case 'point_deleted':
      return { label: 'ההזמנה נמחקה', detail: asText(payload['reason']), isVisible: true };

    case 'point_restored':
      return { label: 'ההזמנה שוחזרה', detail: asText(payload['reason']), isVisible: true };

    case 'updated': {
      return { label: 'עודכנו פרטי הזמנה', detail: null, isVisible: false };
    }

    default:
      return { label: 'עודכן מידע בהזמנה', detail: null, isVisible: true };
  }
}

export function formatOrderEventLabel(event: ManualShiftOrderEvent): string {
  return formatOrderEvent(event).label;
}
