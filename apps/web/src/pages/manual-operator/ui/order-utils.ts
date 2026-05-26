import type { ManualShiftOrderStatus } from '@wos/domain';

export function getOrderStatusLabel(status: ManualShiftOrderStatus): string {
  const labels: Record<ManualShiftOrderStatus, string> = {
    queued: 'בתור',
    picking: 'בליקוט',
    waiting_check: 'ממתין לבדיקה',
    returned: 'הוחזר לתיקון',
    done: 'הסתיים'
  };
  return labels[status] ?? status;
}

export function getOrderStatusColor(status: ManualShiftOrderStatus): string {
  const colors: Record<ManualShiftOrderStatus, string> = {
    queued: 'bg-gray-100 text-gray-800 border-gray-200',
    picking: 'bg-blue-100 text-blue-800 border-blue-200',
    waiting_check: 'bg-amber-100 text-amber-800 border-amber-200',
    returned: 'bg-red-100 text-red-800 border-red-200',
    done: 'bg-green-100 text-green-800 border-green-200'
  };
  return colors[status] ?? 'bg-gray-100 text-gray-800 border-gray-200';
}

export function getElapsedFromIso(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 0) return "0דק'";
  if (mins < 60) return `${mins}דק'`;
  return `${Math.floor(mins / 60)}ש'`;
}
