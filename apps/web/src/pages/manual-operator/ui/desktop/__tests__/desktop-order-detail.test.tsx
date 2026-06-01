import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { formatDateTimeHe } from '@/shared/lib/format-date-time';
import { DesktopOrderDetail } from '../desktop-order-detail';
import { mockOrderDetail } from './fixtures';

describe('DesktopOrderDetail', () => {
  it('renders order detail fields', () => {
    render(<DesktopOrderDetail detail={mockOrderDetail} onClose={vi.fn()} />);
    expect(screen.getAllByText('ORD-001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('קו צפון').length).toBeGreaterThan(0);
    expect(screen.getAllByText('נקודה א').length).toBeGreaterThan(0);
    expect(screen.getByText('דוד')).toBeTruthy();
  });

  it('renders status badge', () => {
    render(<DesktopOrderDetail detail={mockOrderDetail} onClose={vi.fn()} />);
    const statuses = screen.getAllByText('בליקוט');
    expect(statuses.some((el) => el.className.includes('rounded-full'))).toBe(true);
  });

  it('renders section headings', () => {
    render(<DesktopOrderDetail detail={mockOrderDetail} onClose={vi.fn()} />);
    expect(screen.getByText('פרטי הזמנה')).toBeTruthy();
    expect(screen.getByText('עבודה')).toBeTruthy();
    expect(screen.getByText('זמנים')).toBeTruthy();
  });

  it('shows parallel check indicator when status is picking and checkStartedAt exists', () => {
    render(
      <DesktopOrderDetail
        detail={{ ...mockOrderDetail, status: 'picking', checkStartedAt: new Date(Date.now() - 120_000).toISOString() }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/בדיקה במקביל/i)).toBeTruthy();
  });

  it('parallel check indicator does not replace status age row', () => {
    render(
      <DesktopOrderDetail
        detail={{ ...mockOrderDetail, status: 'picking', ageSeconds: 180, checkStartedAt: new Date(Date.now() - 120_000).toISOString() }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('גיל סטטוס')).toBeTruthy();
    expect(screen.getByText(/בדיקה במקביל/i)).toBeTruthy();
  });

  it('renders localized timestamp as DD.MM.YYYY · HH:mm with ltr direction and not raw ISO', () => {
    const rawIso = '2026-05-26T23:57:41.345065+00:00';
    const expected = formatDateTimeHe(rawIso);
    render(
      <DesktopOrderDetail
        detail={{ ...mockOrderDetail, createdAt: rawIso }}
        onClose={vi.fn()}
      />
    );

    expect(expected).toMatch(/^\d{2}\.\d{2}\.\d{4} · \d{2}:\d{2}$/);

    const timestampValue = screen.getByText(expected);
    expect(timestampValue.getAttribute('dir')).toBe('ltr');
    expect(screen.queryByText(rawIso)).toBeNull();
  });

  it('renders dash for null timestamp', () => {
    render(
      <DesktopOrderDetail
        detail={{ ...mockOrderDetail, startedAt: null }}
        onClose={vi.fn()}
      />
    );
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('renders checkStartedAt absolute timestamp in times section', () => {
    const checkStartedAt = '2026-05-27T09:20:00.000Z';
    render(
      <DesktopOrderDetail
        detail={{ ...mockOrderDetail, checkStartedAt }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('הבדיקה התחילה')).toBeTruthy();
    expect(screen.getByText(formatDateTimeHe(checkStartedAt))).toBeTruthy();
  });

  it('renders dash for invalid timestamp', () => {
    render(
      <DesktopOrderDetail
        detail={{ ...mockOrderDetail, startedAt: 'not-a-date' }}
        onClose={vi.fn()}
      />
    );
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByText('not-a-date')).toBeNull();
  });

  it('renders dash when age is null', () => {
    render(
      <DesktopOrderDetail
        detail={{ ...mockOrderDetail, ageSeconds: null, status: 'returned' }}
        onClose={vi.fn()}
      />
    );
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('renders stale not-found state when detail is null', () => {
    render(<DesktopOrderDetail detail={null} onClose={vi.fn()} />);
    expect(screen.getByText(/אינה זמינה/i)).toBeTruthy();
  });

  it('close button calls onClose', () => {
    const onClose = vi.fn();
    render(<DesktopOrderDetail detail={null} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /סגור|close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
