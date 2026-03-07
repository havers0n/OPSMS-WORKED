import { Activity, BarChart3, ChevronLeft, ChevronRight, LayoutGrid, Package } from 'lucide-react';
import { useState } from 'react';

const items = [
  { label: 'Warehouse', icon: LayoutGrid, active: true },
  { label: 'Products', icon: Package, active: false },
  { label: 'Operations', icon: Activity, active: false },
  { label: 'Analytics', icon: BarChart3, active: false }
];

export function LeftDrawer() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={[
        'flex shrink-0 flex-col border-r border-slate-900/90 bg-slate-950 text-slate-200 transition-all duration-200',
        isCollapsed ? 'w-[60px]' : 'w-56'
      ].join(' ')}
    >
      {/* Header */}
      <div
        className={[
          'flex items-center border-b border-slate-800 py-4',
          isCollapsed ? 'justify-center px-0' : 'justify-between px-4'
        ].join(' ')}
      >
        {isCollapsed ? (
          <div className="text-xs font-bold uppercase tracking-widest text-cyan-300/80">W</div>
        ) : (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300/80">WOS</div>
            <div className="mt-0.5 text-sm font-semibold text-white">Warehouse Ops</div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              title={isCollapsed ? item.label : undefined}
              className={[
                'flex items-center rounded-xl border py-2.5 text-left text-sm transition-all',
                isCollapsed ? 'justify-center px-2' : 'gap-3 px-2',
                item.active
                  ? 'border-cyan-400/20 bg-cyan-500/12 text-cyan-100'
                  : 'border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-900/80 hover:text-slate-100'
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  item.active ? 'bg-cyan-500/18 text-cyan-200' : 'bg-slate-900 text-slate-500'
                ].join(' ')}
              >
                <Icon className="h-4 w-4" />
              </span>

              {!isCollapsed && (
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{item.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {item.active ? 'Active' : 'Soon'}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-slate-800 p-2">
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={[
            'flex h-9 w-full items-center rounded-xl border border-transparent px-2 text-slate-500 transition-colors hover:border-slate-800 hover:bg-slate-900 hover:text-slate-300',
            isCollapsed ? 'justify-center' : 'gap-2'
          ].join(' ')}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
