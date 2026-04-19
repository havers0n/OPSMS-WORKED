import { Menu } from 'lucide-react';
import { useIsDrawerCollapsed, useToggleDrawer } from '@/app/store/ui-selectors';
import { IconButton } from '@/shared/ui/icon-button';
import { TopBarShell } from '@/shared/ui/top-bar-shell';
import { AccountControls } from './account-controls';

export function AppHeader() {
  const toggle = useToggleDrawer();
  const isCollapsed = useIsDrawerCollapsed();

  return (
    <TopBarShell
      className="shrink-0 [&>div]:h-11"
      style={{
        background: 'var(--surface-primary)'
      }}
      left={
        <div
          className="flex h-full items-center gap-2 border-r px-3"
          style={{ borderColor: 'var(--border-muted)' }}
        >
          <IconButton
            icon={<Menu className="h-4 w-4" />}
            onClick={toggle}
            title={isCollapsed ? 'Open navigation' : 'Close navigation'}
            className="rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          />
          <span className="text-[11px] font-black tracking-widest" style={{ color: 'var(--accent)' }}>
            W
          </span>
          <span className="text-sm font-semibold text-slate-700">Warehouse Ops</span>
        </div>
      }
      right={<AccountControls />}
    />
  );
}
