import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesktopKpiRow } from '../desktop-kpi-row';
import { mockKpi } from './fixtures';

describe('DesktopKpiRow', () => {
  it('renders all seven KPI values', () => {
    render(<DesktopKpiRow summary={mockKpi} />);

    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('renders all seven labels', () => {
    render(<DesktopKpiRow summary={mockKpi} />);

    expect(screen.getByText('סה״כ')).toBeTruthy();
    expect(screen.getByText('בתור')).toBeTruthy();
    expect(screen.getByText('בליקוט')).toBeTruthy();
    expect(screen.getByText('בדיקה')).toBeTruthy();
    expect(screen.getByText('הוחזר')).toBeTruthy();
    expect(screen.getByText('הסתיימו')).toBeTruthy();
    expect(screen.getByText('תקלות')).toBeTruthy();
  });
});