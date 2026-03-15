import { useState } from 'react';
import { Package, Waves } from 'lucide-react';
import { OrdersPage } from '@/pages/orders/ui/orders-page';
import { WavesPage } from '@/pages/waves/ui/waves-page';

type OperationsTab = 'waves' | 'orders';

const TABS: { id: OperationsTab; label: string; icon: typeof Waves }[] = [
  { id: 'waves', label: 'Waves', icon: Waves },
  { id: 'orders', label: 'Orders', icon: Package }
];

export function OperationsPage() {
  const [activeTab, setActiveTab] = useState<OperationsTab>('waves');

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Tab bar */}
      <div
        className="flex shrink-0 items-center gap-1 border-b px-4"
        style={{ borderColor: 'var(--border-strong)', background: 'var(--surface-primary)' }}
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-cyan-600 text-cyan-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Page content — each tab fills remaining height */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'waves' ? <WavesPage /> : <OrdersPage />}
      </div>
    </div>
  );
}
