const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jerusalem',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});

const TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jerusalem',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

const MISSING_VALUE = '—';

export function formatDateTimeHe(value: string | null | undefined): string {
  if (!value) return MISSING_VALUE;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return MISSING_VALUE;

  const [day, month, year] = DATE_FORMATTER.format(date).split('/');
  return `${day}.${month}.${year} · ${TIME_FORMATTER.format(date)}`;
}
