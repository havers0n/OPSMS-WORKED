import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/shared/i18n/i18n-provider';

vi.mock('@/app/store/ui-selectors', () => ({
  useIsDrawerCollapsed: () => false,
  useToggleDrawer: () => vi.fn()
}));

import { LeftDrawer } from '@/widgets/app-shell/ui/left-drawer';

function renderDrawer() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <LeftDrawer />
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('LeftDrawer', () => {
  it('renders the Actions entry', () => {
    renderDrawer();
    expect(screen.getByText('פעולות')).toBeTruthy();
  });

  it('Actions entry navigates to /warehouse/actions', () => {
    renderDrawer();
    const actionsLink = screen.getByText('פעולות').closest('a');
    expect(actionsLink).toBeTruthy();
    expect(actionsLink!.getAttribute('href')).toBe('/warehouse/actions');
  });

  it('does not contain a direct sidebar entry for labels', () => {
    renderDrawer();
    const allLinks = screen.getAllByRole('link');
    const labelsLinks = allLinks.filter((link) => link.getAttribute('href')?.includes('/warehouse/labels'));
    expect(labelsLinks).toHaveLength(0);
  });
});