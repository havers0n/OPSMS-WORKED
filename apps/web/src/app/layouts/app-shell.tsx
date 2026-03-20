import { Outlet, useLocation } from 'react-router-dom';
import { AppHeader } from '@/widgets/app-shell/ui/app-header';
import { LeftDrawer } from '@/widgets/app-shell/ui/left-drawer';
import { routes } from '@/shared/config/routes';

export function AppShell() {
  const location = useLocation();
  const isWarehouseRoute = location.pathname.startsWith(routes.warehouse);

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: 'var(--app-bg)' }}>
      {!isWarehouseRoute && <AppHeader />}
      <main className="flex flex-1 overflow-hidden">
        <LeftDrawer />
        <Outlet />
      </main>
    </div>
  );
}
