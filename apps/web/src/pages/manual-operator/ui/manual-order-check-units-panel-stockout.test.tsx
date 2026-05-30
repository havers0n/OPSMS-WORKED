import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ManualShiftOrderCheckUnit } from '@wos/domain';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManualOrderCheckUnitsPanel } from './manual-order-check-units-panel';

vi.mock('@/shared/api/bff/client', async importOriginal => {
  const actual = await importOriginal<typeof import('@/shared/api/bff/client')>();
  return { ...actual, bffRequest: vi.fn() };
});

import { bffRequest } from '@/shared/api/bff/client';

const mockedBffRequest = vi.mocked(bffRequest);

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
}

function makeCheckUnit(
  unitNumber: number,
  status: ManualShiftOrderCheckUnit['status'],
  overrides: Partial<ManualShiftOrderCheckUnit> = {}
): ManualShiftOrderCheckUnit {
  return {
    id: `cu-${unitNumber}`,
    tenantId: 'tenant-1',
    shiftId: 'shift-1',
    lineId: 'line-1',
    orderId: 'order-1',
    unitNumber,
    status,
    note: null,
    reason: null,
    checkedAt: null,
    returnedAt: null,
    voidedAt: null,
    createdAt: '2026-05-29T09:00:00.000Z',
    updatedAt: '2026-05-29T09:00:00.000Z',
    ...overrides
  };
}

type PanelProps = Parameters<typeof ManualOrderCheckUnitsPanel>[0];
function renderPanel(props?: Partial<PanelProps>) {
  return render(
    <QueryClientProvider client={makeQC()}>
      <ManualOrderCheckUnitsPanel orderId="order-1" interactive {...props} />
    </QueryClientProvider>
  );
}

describe('ManualOrderCheckUnitsPanel - Stockout Flow Refinement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selecting מוצר אזל hides reason grid and shows choice screen', async () => {
    mockedBffRequest.mockResolvedValue([makeCheckUnit(1, 'open')]);
    renderPanel();

    await waitFor(() => expect(screen.getByText('תקלה')).toBeTruthy());
    fireEvent.click(screen.getByText('תקלה'));

    expect(screen.getByText('בחר סיבת תיקון')).toBeTruthy();
    expect(screen.getByText('מוצר אזל')).toBeTruthy();

    fireEvent.click(screen.getByText('מוצר אזל'));

    // Reason grid should be hidden
    expect(screen.queryByText('בחר סיבת תיקון')).toBeNull();
    
    // Choice screen should be visible
    expect(screen.getByText('המוצר אזל')).toBeTruthy();
    expect(screen.getByText('מה צריך לעשות?')).toBeTruthy();
    expect(screen.getByText('דיווח בלבד')).toBeTruthy();
    expect(screen.getByText('צור השלמה')).toBeTruthy();
    expect(screen.getByText('חזרה לסיבות')).toBeTruthy();
  });

  it('can go back to reasons from choice screen', async () => {
    mockedBffRequest.mockResolvedValue([makeCheckUnit(1, 'open')]);
    renderPanel();

    await waitFor(() => expect(screen.getByText('תקלה')).toBeTruthy());
    fireEvent.click(screen.getByText('תקלה'));
    fireEvent.click(screen.getByText('מוצר אזל'));
    
    expect(screen.getByText('חזרה לסיבות')).toBeTruthy();
    fireEvent.click(screen.getByText('חזרה לסיבות'));

    expect(screen.getByText('בחר סיבת תיקון')).toBeTruthy();
    expect(screen.queryByText('המוצר אזל')).toBeNull();
  });

  it('selecting "דיווח בלבד" shows stockout report form only', async () => {
    mockedBffRequest.mockResolvedValue([makeCheckUnit(1, 'open')]);
    renderPanel();

    await waitFor(() => expect(screen.getByText('תקלה')).toBeTruthy());
    fireEvent.click(screen.getByText('תקלה'));
    fireEvent.click(screen.getByText('מוצר אזל'));
    
    fireEvent.click(screen.getByText('דיווח בלבד'));

    expect(screen.getByText('איזה מוצר אזל?')).toBeTruthy();
    expect(screen.getByText('דווח על מוצר שאזל')).toBeTruthy();
    expect(screen.queryByText('מה צריך לעשות?')).toBeNull();
    expect(screen.queryByText('מה צריך להשלים?')).toBeNull();
  });

  it('selecting "צור השלמה" shows ashlama form only', async () => {
    mockedBffRequest.mockResolvedValue([makeCheckUnit(1, 'open')]);
    renderPanel();

    await waitFor(() => expect(screen.getByText('תקלה')).toBeTruthy());
    fireEvent.click(screen.getByText('תקלה'));
    fireEvent.click(screen.getByText('מוצר אזל'));
    
    fireEvent.click(screen.getByText('צור השלמה'));

    expect(screen.getByText('מה צריך להשלים?')).toBeTruthy();
    // Two "צור השלמה" buttons: one in the choice screen (now hidden), and one in the form.
    // Actually, only one should be visible now.
    expect(screen.getByText('מה צריך להשלים?')).toBeTruthy();
    expect(screen.getByText('צור השלמה')).toBeTruthy();
    expect(screen.queryByText('מה צריך לעשות?')).toBeNull();
    expect(screen.queryByText('איזה מוצר אזל?')).toBeNull();
  });

  it('can go back from specific forms to choice screen', async () => {
    mockedBffRequest.mockResolvedValue([makeCheckUnit(1, 'open')]);
    renderPanel();

    await waitFor(() => expect(screen.getByText('תקלה')).toBeTruthy());
    fireEvent.click(screen.getByText('תקלה'));
    fireEvent.click(screen.getByText('מוצר אזל'));
    
    fireEvent.click(screen.getByText('דיווח בלבד'));
    expect(screen.getByText('חזרה')).toBeTruthy();
    fireEvent.click(screen.getByText('חזרה'));

    expect(screen.getByText('מה צריך לעשות?')).toBeTruthy();
  });

  it('state is isolated between units and cleared on reopen', async () => {
    mockedBffRequest.mockResolvedValue([makeCheckUnit(1, 'open'), makeCheckUnit(2, 'open')]);
    renderPanel();

    await waitFor(() => expect(screen.getAllByText('תקלה')).toHaveLength(2));
    
    // Open unit 1 stockout flow and go to choice screen
    const unit1Row = screen.getByTestId('check-unit-cu-1');
    fireEvent.click(unit1Row.querySelector('button.bg-red-100')!); // "תקלה"
    fireEvent.click(screen.getByText('מוצר אזל'));
    expect(screen.getByText('מה צריך לעשות?')).toBeTruthy();

    // Open unit 2
    const unit2Row = screen.getByTestId('check-unit-cu-2');
    fireEvent.click(unit2Row.querySelector('button.bg-red-100')!); // "תקלה"
    
    // Unit 2 should show the reason grid (fresh start)
    expect(screen.getByTestId('returned-reason-selector-cu-2').textContent).toContain('בחר סיבת תיקון');
    expect(screen.queryByText('מה צריך לעשות?')).toBeNull();

    // Re-open unit 1
    fireEvent.click(unit1Row.querySelector('button.bg-red-100')!); // "תקלה"
    
    // Unit 1 should ALSO show the reason grid (fresh start)
    expect(screen.getByTestId('returned-reason-selector-cu-1').textContent).toContain('בחר סיבת תיקון');
    expect(screen.queryByText('מה צריך לעשות?')).toBeNull();
  });

  it('clears stockout step when selecting a non-azal reason', async () => {
    mockedBffRequest.mockResolvedValue([makeCheckUnit(1, 'open')]);
    renderPanel();

    await waitFor(() => expect(screen.getByText('תקלה')).toBeTruthy());
    fireEvent.click(screen.getByText('תקלה'));
    fireEvent.click(screen.getByText('מוצר אזל'));
    expect(screen.getByText('מה צריך לעשות?')).toBeTruthy();

    // Select another reason
    // Wait, the grid is hidden when מוצר אזל is selected. 
    // I need to go back to reasons first.
    fireEvent.click(screen.getByText('חזרה לסיבות'));
    fireEvent.click(screen.getByText('כמות לא נכונה'));
    
    // Grid should still be visible (for confirmation of other reasons)
    expect(screen.getByText('בחר סיבת תיקון')).toBeTruthy();
    expect(screen.queryByText('מה צריך לעשות?')).toBeNull();
  });
});
