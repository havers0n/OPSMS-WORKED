import { LayoutGrid, Package, Activity, BarChart3 } from 'lucide-react';

const items = [
  { label: 'Warehouse', icon: LayoutGrid, active: true },
  { label: 'Products', icon: Package, active: false },
  { label: 'Operations', icon: Activity, active: false },
  { label: 'Analytics', icon: BarChart3, active: false }
];

export function LeftDrawer() {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-slate-900/90 bg-slate-950 text-slate-200">
      <div className="border-b border-slate-800 px-5 py-5">
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/80">WOS</div>
        <div className="mt-3 text-lg font-semibold text-white">Warehouse Ops Surface</div>
        <div className="mt-1 text-sm text-slate-400">Setup, stock-aware readiness, and directed picking.</div>
      </div>
      <nav className="flex flex-1 flex-col gap-2 p-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              className={[
                'flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-all',
                item.active
                  ? 'border-cyan-400/20 bg-cyan-500/12 text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                  : 'border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-900/80 hover:text-slate-100'
              ].join(' ')}
              type="button"
            >
              <span className={[ 'flex h-10 w-10 items-center justify-center rounded-xl', item.active ? 'bg-cyan-500/18 text-cyan-200' : 'bg-slate-900 text-slate-500' ].join(' ')}>
                <Icon className="h-4 w-4" />
              </span>
              <span>
                <span className="block font-medium">{item.label}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{item.active ? 'Current workspace' : 'Coming next'}</span>
              </span>
            </button>
          );
        })}
      </nav>
      <div className="border-t border-slate-800 px-5 py-4 text-xs text-slate-500">
        Published layout is immutable. Drafts stay local until explicit save and publish.
      </div>
    </aside>
  );
}
