import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PickerSheetWorkGroupBlock } from './PickerSheetWorkGroupBlock';
import type { PickerSheetWorkGroup } from '../types/printDtos';

function makeWorkGroup(overrides?: Partial<PickerSheetWorkGroup>): PickerSheetWorkGroup {
  return {
    name: 'קבוצה א',
    items: [
      { sku: 'PREM-ABC001', displaySku: 'ABC001', productName: 'מחברת A4', quantity: 10, warning: 'sku_display_collision' },
      { sku: '123456', displaySku: '123456', productName: 'עט כדורי', quantity: 5 },
    ],
    ...overrides,
  };
}

describe('PickerSheetWorkGroupBlock', () => {
  it('renders full SKU when warning is sku_display_collision', () => {
    render(<PickerSheetWorkGroupBlock workGroup={makeWorkGroup()} scope="area" lineName="קו 1" isFirst />);
    expect(screen.getByText('PREM-ABC001')).toBeDefined();
  });

  it('renders displaySku when no collision warning', () => {
    render(<PickerSheetWorkGroupBlock workGroup={makeWorkGroup()} scope="area" lineName="קו 1" isFirst />);
    expect(screen.getByText('123456')).toBeDefined();
  });

  it('renders collision warning text in Hebrew', () => {
    render(<PickerSheetWorkGroupBlock workGroup={makeWorkGroup()} scope="area" lineName="קו 1" isFirst />);
    expect(screen.getByText('התנגשות')).toBeDefined();
  });

  it('renders product names', () => {
    render(<PickerSheetWorkGroupBlock workGroup={makeWorkGroup()} scope="area" lineName="קו 1" isFirst />);
    expect(screen.getByText('מחברת A4')).toBeDefined();
    expect(screen.getByText('עט כדורי')).toBeDefined();
  });

  it('renders quantities', () => {
    render(<PickerSheetWorkGroupBlock workGroup={makeWorkGroup()} scope="area" lineName="קו 1" isFirst />);
    expect(screen.getByText('10')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
  });

  it('renders all four column headers in Hebrew', () => {
    render(<PickerSheetWorkGroupBlock workGroup={makeWorkGroup()} scope="area" lineName="קו 1" isFirst />);
    expect(screen.getByText('מק״ט')).toBeDefined();
    expect(screen.getByText('שם מוצר')).toBeDefined();
    expect(screen.getByText('כמות')).toBeDefined();
    expect(screen.getByText('הערה')).toBeDefined();
  });

  it('does not render order numbers', () => {
    render(<PickerSheetWorkGroupBlock workGroup={makeWorkGroup()} scope="area" lineName="קו 1" isFirst />);
    expect(screen.queryByText('מס\' הזמנה')).toBeNull();
    expect(screen.queryByText(/SO-/)).toBeNull();
  });

  describe('page-break behavior', () => {
    it('does not force page break for first block in workGroup scope', () => {
      const { container } = render(<PickerSheetWorkGroupBlock workGroup={makeWorkGroup()} scope="workGroup" lineName="קו 1" isFirst />);
      expect((container.firstChild as HTMLElement).className).not.toContain('page-break-before');
    });

    it('forces page break for non-first block in area scope', () => {
      const { container } = render(<PickerSheetWorkGroupBlock workGroup={makeWorkGroup()} scope="area" lineName="קו 1" isFirst={false} />);
      expect((container.firstChild as HTMLElement).className).toContain('page-break-before');
    });

    it('does not force page break for first block in area scope', () => {
      const { container } = render(<PickerSheetWorkGroupBlock workGroup={makeWorkGroup()} scope="area" lineName="קו 1" isFirst />);
      expect((container.firstChild as HTMLElement).className).not.toContain('page-break-before');
    });

    it('forces page break for non-first block in line scope', () => {
      const { container } = render(<PickerSheetWorkGroupBlock workGroup={makeWorkGroup()} scope="line" lineName="קו 1" isFirst={false} />);
      expect((container.firstChild as HTMLElement).className).toContain('page-break-before');
    });
  });
});
