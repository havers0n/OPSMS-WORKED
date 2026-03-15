import { Outlet } from 'react-router-dom';
import { AppHeader } from '@/widgets/app-shell/ui/app-header';
import { LeftDrawer } from '@/widgets/app-shell/ui/left-drawer';

export function AppShell() {
  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: 'var(--app-bg)' }}>
      <AppHeader />
      <main className="flex flex-1 overflow-hidden">
        <LeftDrawer />
        <Outlet />
      </main>
    </div>
  );
}
