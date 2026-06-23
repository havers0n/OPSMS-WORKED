import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BondedRequestStatusBadge } from './bonded-request-status-badge';

describe('BondedRequestStatusBadge', () => {
  it('renders "בקשה פתוחה" for open status', () => {
    render(<BondedRequestStatusBadge status="open" />);
    expect(screen.getByText('בקשה פתוחה')).toBeTruthy();
  });

  it('renders "בקשה סגורה" for closed status', () => {
    render(<BondedRequestStatusBadge status="closed" />);
    expect(screen.getByText('בקשה סגורה')).toBeTruthy();
  });

  it('renders "בקשה מבוטלת" for cancelled status', () => {
    render(<BondedRequestStatusBadge status="cancelled" />);
    expect(screen.getByText('בקשה מבוטלת')).toBeTruthy();
  });
});
