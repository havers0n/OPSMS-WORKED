import { BarChart3, Eye, Layers, LayoutGrid, Package, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useIsDrawerCollapsed, useToggleDrawer } from '@/app/store/ui-selectors';
import { routes } from '@/shared/config/routes';
import { Drawer } from '@/shared/ui/drawer';
import { IconButton } from '@/shared/ui/icon-button';

type NavigationItem =
  | { label: string; description: string; icon: typeof LayoutGrid; enabled: true; to: string }
  | { label: string; description: string; icon: typeof LayoutGrid; enabled: false };

const items: NavigationItem[] = [
  {
    label: 'Warehouse',
    description: 'Floor plan editor',
    icon: LayoutGrid,
    to: routes.warehouse,
    enabled: true
  },
  {
    label: 'Live View',
    description: 'Read-only floor map',
    icon: Eye,
    to: routes.warehouseView,
    enabled: true
  },
  {
    label: 'Products',
    description: 'Product catalog',
    icon: Package,
    to: routes.products,
    enabled: true
  },
  {
    label: 'Operations',
    description: 'Waves & orders',
    icon: Layers,
    to: routes.operations,
    enabled: true
  },
  {
    label: 'Analytics',
    description: 'Coming soon',
    icon: BarChart3,
    enabled: false
  }
];

export function LeftDrawer() {
  const isCollapsed = useIsDrawerCollapsed();
  const toggle = useToggleDrawer();

  if (isCollapsed) return null;

  return (
    <Drawer
      className="w-56 max-w-none border-y-0 border-l-0 border-r border-r-slate-900/90 bg-slate-950 text-slate-200 [&_[role=separator]]:bg-slate-800"
      bodyClassName="px-2 py-2"
      header={
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300/80">
              WOS
            </div>
            <div className="mt-0.5 text-sm font-semibold text-white">Warehouse Ops</div>
          </div>
          <IconButton
            icon={<X className="h-4 w-4" />}
            onClick={toggle}
            className="rounded-lg text-slate-500 hover:bg-slate-800 hover:text-slate-300"
          />
        </div>
      }
    >
      <nav className="flex flex-1 flex-col gap-1">
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
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {item.description}
                  </span>
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
                      {item.description}
                    </span>
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </Drawer>
  );
}
