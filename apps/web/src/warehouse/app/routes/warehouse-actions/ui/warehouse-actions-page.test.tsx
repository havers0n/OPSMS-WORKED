import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/shared/i18n/i18n-provider';

const mockUseActiveFloorId = vi.hoisted(() => vi.fn());
vi.mock('@/app/store/ui-selectors', () => ({
  useActiveFloorId: mockUseActiveFloorId
}));

vi.mock('@/warehouse/shell/ui/warehouse-top-bar', () => ({
  WarehouseTopBar: () => <div data-testid="warehouse-top-bar">TopBar</div>
}));

import { WarehouseActionsPage } from './warehouse-actions-page';

function renderActionsPage() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <WarehouseActionsPage />
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('WarehouseActionsPage', () => {
  beforeEach(() => {
    mockUseActiveFloorId.mockReturnValue(null);
  });

  it('renders the actions page title', () => {
    renderActionsPage();
    expect(screen.getByText('פעולות מחסן')).toBeTruthy();
  });

  it('renders the label printing card', () => {
    renderActionsPage();
    expect(screen.getByText('הדפסת תוויות מיקום')).toBeTruthy();
  });

  it('disables the card when no active floor', () => {
    mockUseActiveFloorId.mockReturnValue(null);
    renderActionsPage();
    const button = screen.getByRole('button', { name: /הדפסת תוויות מיקום/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('אין קומה פעילה. יש לבחור קומה תחילה.')).toBeTruthy();
  });

  it('enables the card when an active floor exists', () => {
    mockUseActiveFloorId.mockReturnValue('11111111-1111-4111-8111-111111111111');
    renderActionsPage();
    const button = screen.getByRole('button', { name: /הדפסת תוויות מיקום/i });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it('navigates to labels page with floorId when card is clicked', async () => {
    const user = userEvent.setup();
    mockUseActiveFloorId.mockReturnValue('11111111-1111-4111-8111-111111111111');

    const { rerender } = renderActionsPage();
    const button = screen.getByRole('button', { name: /הדפסת תוויות מיקום/i });

    await user.click(button);
    rerender(
      <MemoryRouter>
        <I18nProvider>
          <WarehouseActionsPage />
        </I18nProvider>
      </MemoryRouter>
    );
  });
});