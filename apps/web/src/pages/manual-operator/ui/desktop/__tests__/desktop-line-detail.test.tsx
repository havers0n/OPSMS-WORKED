import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DesktopLineDetail } from '../desktop-line-detail';
import { mockLineDetail } from './fixtures';

describe('DesktopLineDetail', () => {
  it('renders stale selection safe state when summary is null', () => {
    render(<DesktopLineDetail detail={{ summary: null, orders: [] }} onClose={vi.fn()} />);

    expect(screen.getByText('הקו שנבחר אינו זמין יותר.')).toBeTruthy();
  });

  it('renders detail rows from read model', () => {
    render(<DesktopLineDetail detail={mockLineDetail} onClose={vi.fn()} />);

    expect(screen.getByText('קו צפון')).toBeTruthy();
    expect(screen.getByText('ORD-001')).toBeTruthy();
  });
});