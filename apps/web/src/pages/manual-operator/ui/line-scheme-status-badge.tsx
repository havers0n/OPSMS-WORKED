export function statusBadgeConfig(status: string): { tone: 'neutral' | 'success' | 'warning' | 'info' | 'danger'; label: string } {
  switch (status) {
    case 'unassigned': return { tone: 'neutral', label: 'לא שובץ' };
    case 'assigned': return { tone: 'success', label: 'שובץ' };
    case 'partial': return { tone: 'warning', label: 'שובץ חלקית' };
    case 'split': return { tone: 'info', label: 'מפוצל' };
    default: return { tone: 'danger', label: 'דורש בדיקה' };
  }
}

export function backendStatusBadgeConfig(status: string): { tone: 'neutral' | 'success' | 'warning' | 'info' | 'danger'; label: string } {
  switch (status) {
    case 'queued': return { tone: 'neutral', label: 'בהמתנה' };
    case 'picking': return { tone: 'warning', label: 'באיסוף' };
    case 'waiting_check': return { tone: 'info', label: 'ממתין לבדיקה' };
    case 'returned': return { tone: 'danger', label: 'הוחזר' };
    case 'done': return { tone: 'success', label: 'הושלם' };
    default: return { tone: 'neutral', label: status };
  }
}
