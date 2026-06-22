import { useState } from 'react';
import { Plus, PackageOpen } from 'lucide-react';
import type { SourceOrderItem } from './scheme-types';
import { useSchemeBuilderStore } from './scheme-store';
import { WorkGroupCard } from './work-group-card';
import { WorkGroupCreateModal } from './work-group-create-modal';

export function WorkGroupWorkspace({
  selectedAreaName,
  orderItemMap,
  onOpenAssignModal,
}: {
  selectedAreaName: string;
  orderItemMap: Record<string, SourceOrderItem[]>;
  onOpenAssignModal: () => void;
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const workGroups = useSchemeBuilderStore((s) => s.workGroups);
  const createWorkGroup = useSchemeBuilderStore((s) => s.createWorkGroup);

  const areaGroups = workGroups.filter((wg) => wg.areaName === selectedAreaName);

  const handleCreate = (name: string) => {
    createWorkGroup(selectedAreaName, name);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">קבוצות עבודה</h2>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          קבוצת עבודה
        </button>
      </div>

      {areaGroups.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-10 text-center">
          <PackageOpen size={48} className="text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-800 mb-2">אין קבוצות עבודה</h3>
          <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
            יש ליצור קבוצות עבודה ולשייך אליהן שורות מוצר מההזמנות.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            צור קבוצת עבודה
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {areaGroups.map((wg) => (
            <WorkGroupCard
              key={wg.id}
              workGroup={wg}
              orderItemMap={orderItemMap}
              onAssignItems={onOpenAssignModal}
            />
          ))}
        </div>
      )}

      <WorkGroupCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
