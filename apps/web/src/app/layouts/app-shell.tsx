import { Outlet } from 'react-router-dom';
import { LeftDrawer } from '@/widgets/app-shell/ui/left-drawer';
import { TopBar } from '@/widgets/app-shell/ui/top-bar';

export function AppShell() {
  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: 'var(--app-bg)' }}>
      <TopBar />
      <main className="flex flex-1 overflow-hidden">
        <LeftDrawer />
        <Outlet />
      </main>
    </div>
  );
}
