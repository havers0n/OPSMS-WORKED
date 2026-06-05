import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/shared/i18n/i18n-provider';
import { routes } from '@/shared/config/routes';

vi.mock('@/app/router/protected-route', () => ({ ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/app/layouts/app-shell', async () => {
  const { Outlet } = await import('react-router-dom');
  return { AppShell: () => <div><Outlet /></div> };
});
// Mock pages that rely on app providers (react-query, etc.) so router tests stay focused
vi.mock('@/pages/manual-operator/ui/manual-operator-page', () => ({ ManualOperatorPage: () => <div>Artos Operator</div> }));
vi.mock('@/pages/products/ui/products-page', () => ({ ProductsPage: () => <div>Product Catalog</div> }));
vi.mock('@/pages/picking/ui/picking-queue-page', () => ({ PickingQueuePage: () => <div data-testid="picking-queue-page">Picking Queue</div> }));

describe('AppRouter lazy routes', () => {
  beforeEach(() => {
    // reset history before each test
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders ManualOperatorPage at /operator/manual', async () => {
    window.history.pushState({}, '', routes.operatorManual);
    const { AppRouter } = await import('./routes');

    render(
      <I18nProvider>
        <AppRouter />
      </I18nProvider>
    );

    const header = await screen.findByText('Artos Operator');
    expect(header).toBeTruthy();
  });

  it('renders ProductsPage at /products', async () => {
    window.history.pushState({}, '', routes.products);
    const { AppRouter } = await import('./routes');

    render(
      <I18nProvider>
        <AppRouter />
      </I18nProvider>
    );

    const title = await screen.findByText('Product Catalog');
    expect(title).toBeTruthy();
  });

  it('renders PickingQueuePage at /tasks', async () => {
    window.history.pushState({}, '', routes.tasks);
    const { AppRouter } = await import('./routes');

    render(
      <I18nProvider>
        <AppRouter />
      </I18nProvider>
    );

    expect(await screen.findByTestId('picking-queue-page')).toBeTruthy();
  });

  it('redirects /picking to /tasks', async () => {
    window.history.pushState({}, '', routes.picking);
    const { AppRouter } = await import('./routes');

    render(
      <I18nProvider>
        <AppRouter />
      </I18nProvider>
    );

    expect(await screen.findByTestId('picking-queue-page')).toBeTruthy();
  });

  it('redirects /picking/run to /tasks', async () => {
    window.history.pushState({}, '', routes.pickingRun);
    const { AppRouter } = await import('./routes');

    render(
      <I18nProvider>
        <AppRouter />
      </I18nProvider>
    );

    expect(await screen.findByTestId('picking-queue-page')).toBeTruthy();
  });
});
