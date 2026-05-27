import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DesktopPickerDetail } from '../desktop-picker-detail';
import { mockPickerDetail } from './fixtures';

describe('DesktopPickerDetail', () => {
  it('renders stale selection safe state when summary is null', () => {
    render(
      <DesktopPickerDetail
        detail={{ summary: null, orders: [], lineBreakdown: [] }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('המלקט שנבחר אינו זמין יותר.')).toBeTruthy();
  });

  it('renders unassigned label when pickerName is null', () => {
    render(
      <DesktopPickerDetail
        detail={{ ...mockPickerDetail, summary: { ...mockPickerDetail.summary!, pickerName: null } }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('לא משויך')).toBeTruthy();
  });
});