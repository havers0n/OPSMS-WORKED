import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesktopKpiRow } from '../desktop-kpi-row';
import { mockKpi } from './fixtures';

describe('DesktopKpiRow', () => {
  it('renders all seven KPI values', () => {
    render(<DesktopKpiRow summary={mockKpi} />);

    expect(screen.getByText('20')).toBeTruthy(); // total
    expect(screen.getByText('5')).toBeTruthy();  // queued
    expect(screen.getByText('7')).toBeTruthy();  // picking
    expect(screen.getByText('3')).toBeTruthy();  // waitingCheck
    expect(screen.getByText('1')).toBeTruthy();  // returned
    expect(screen.getByText('4')).toBeTruthy();  // done
    expect(screen.getByText('2')).toBeTruthy();  // errors
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

  it('uses "בדיקה" label for waitingCheck, not "ממתין"', () => {
    render(<DesktopKpiRow summary={mockKpi} />);

    expect(screen.getByText('בדיקה')).toBeTruthy();
    expect(screen.queryByText('ממתין')).toBeNull();
  });

  it('uses "הסתיימו" label for done, not "הסתיים"', () => {
    render(<DesktopKpiRow summary={mockKpi} />);

    expect(screen.getByText('הסתיימו')).toBeTruthy();
    expect(screen.queryByText('הסתיים')).toBeNull();
  });

  it('renders zero values as "0" not blank', () => {
    const zeroKpi = {
      totalOrders: 0,
      queued: 0,
      picking: 0,
      waitingCheck: 0,
      returned: 0,
      done: 0,
      errorsCount: 0,
      donePercent: 0
    };
    render(<DesktopKpiRow summary={zeroKpi} />);

    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBe(7);
  });
});
