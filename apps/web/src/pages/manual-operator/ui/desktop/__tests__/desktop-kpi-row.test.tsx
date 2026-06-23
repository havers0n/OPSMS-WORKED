import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesktopKpiRow } from '../desktop-kpi-row';
import { mockKpi } from './fixtures';

describe('DesktopKpiRow', () => {
  it('renders compact KPI values', () => {
    render(<DesktopKpiRow summary={mockKpi} />);

    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('renders compact KPI labels', () => {
    render(<DesktopKpiRow summary={mockKpi} />);

    expect(screen.getByText('סה״כ')).toBeTruthy();
    expect(screen.getByText('בתור')).toBeTruthy();
    expect(screen.getByText('פעיל')).toBeTruthy();
    expect(screen.getByText('הוחזר')).toBeTruthy();
    expect(screen.getByText('הסתיימו')).toBeTruthy();
    expect(screen.getByText('תקלות')).toBeTruthy();
  });
});
