import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { formatDateTimeHe } from '@/shared/lib/format-date-time';
import { DesktopOrderDetail } from '../desktop-order-detail';
import { mockOrderDetail } from './fixtures';

describe('DesktopOrderDetail', () => {
  it('renders order detail fields', () => {
    render(<DesktopOrderDetail detail={mockOrderDetail} onClose={vi.fn()} />);
    expect(screen.getByText('ORD-001')).toBeTruthy();
    expect(screen.getByText('קו צפון')).toBeTruthy();
    expect(screen.getByText('נקודה א')).toBeTruthy();
    expect(screen.getByText('דוד')).toBeTruthy();
  });

  it('renders localized timestamp and not raw ISO', () => {
    const rawIso = '2026-05-26T23:57:41.345065+00:00';
    const expected = formatDateTimeHe(rawIso);
    render(
      <DesktopOrderDetail
        detail={{ ...mockOrderDetail, createdAt: rawIso }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(expected)).toBeTruthy();
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
