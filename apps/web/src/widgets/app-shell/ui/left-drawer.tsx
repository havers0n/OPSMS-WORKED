import { Activity, BarChart3, LayoutGrid, Package, X, type LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useIsDrawerCollapsed, useToggleDrawer } from '@/app/store/ui-selectors';
import { routes } from '@/shared/config/routes';

type NavigationItem =
  | { label: string; icon: typeof LayoutGrid; enabled: true; to: string }
  | { label: string; icon: typeof LayoutGrid; enabled: false };

const items: NavigationItem[] = [
  { label: 'Warehouse', icon: LayoutGrid, to: routes.warehouse, enabled: true },
  { label: 'Products', icon: Package, to: routes.products, enabled: true },
  { label: 'Operations', icon: Activity, to: routes.operations, enabled: true },
  { label: 'Analytics', icon: BarChart3, enabled: false }
];

export function LeftDrawer() {
  const isCollapsed = useIsDrawerCollapsed();
  const toggle = useToggleDrawer();

  if (isCollapsed) return null;

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-900/90 bg-slate-950 text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300/80">WOS</div>
          <div className="mt-0.5 text-sm font-semibold text-white">Warehouse Ops</div>
        </div>
        <button
          type="button"
          onClick={toggle}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-2">
        {items.map((item) => {
          const Icon = item.icon;

          if (!item.enabled) {
            return (
              <button
                key={item.label}
                type="button"
                disabled
                className="flex cursor-not-allowed items-center gap-3 rounded-xl border border-transparent px-2 py-2.5 text-left text-sm text-slate-500 opacity-70"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-slate-500">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{item.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">Soon</span>
                </span>
              </button>
            );
          }

          return (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-xl border px-2 py-2.5 text-left text-sm transition-all',
                  isActive
                    ? 'border-cyan-400/20 bg-cyan-500/12 text-cyan-100'
                    : 'border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-900/80 hover:text-slate-100'
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={[
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      isActive ? 'bg-cyan-500/18 text-cyan-200' : 'bg-slate-900 text-slate-500'
                    ].join(' ')}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{item.label}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {isActive ? 'Active' : 'Open'}
                    </span>
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
