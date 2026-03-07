import { Outlet } from 'react-router-dom';
import { LeftDrawer } from '@/widgets/app-shell/ui/left-drawer';
import { TopBar } from '@/widgets/app-shell/ui/top-bar';

export function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-transparent text-slate-900">
      <LeftDrawer />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-hidden px-5 pb-5 pt-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
