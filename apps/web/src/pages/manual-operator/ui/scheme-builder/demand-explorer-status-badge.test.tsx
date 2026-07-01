import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DemandExplorerStatusBadge } from './demand-explorer-status-badge';

describe('DemandExplorerStatusBadge', () => {
  it('renders unassigned label', () => {
    render(<DemandExplorerStatusBadge status="unassigned" />);
    expect(screen.getByText('לא שויך')).toBeTruthy();
  });

  it('renders partial label', () => {
    render(<DemandExplorerStatusBadge status="partial" />);
    expect(screen.getByText('שויך חלקית')).toBeTruthy();
  });

  it('renders assigned label', () => {
    render(<DemandExplorerStatusBadge status="assigned" />);
    expect(screen.getByText('שויך')).toBeTruthy();
  });

  it('renders over_allocated label', () => {
    render(<DemandExplorerStatusBadge status="over_allocated" />);
    expect(screen.getByText('חריגה')).toBeTruthy();
  });
});
