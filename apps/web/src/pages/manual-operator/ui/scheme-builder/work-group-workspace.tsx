import { useState } from 'react';
import { Plus, ClipboardList } from 'lucide-react';
import type { SourceOrderItem } from './scheme-types';
import { useSchemeBuilderStore } from './scheme-store';
import { PlanningLineSection } from './planning-line-section';
import { PlanningLineCreateModal } from './planning-line-create-modal';

export function WorkGroupWorkspace({
  selectedAreaName,
  orderItemMap,
  onStartAssign,
}: {
  selectedAreaName: string;
  orderItemMap: Record<string, SourceOrderItem[]>;
  onStartAssign: (workGroupId: string) => void;
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const getPlanningLinesByArea = useSchemeBuilderStore((s) => s.getPlanningLinesByArea);
  const createPlanningLine = useSchemeBuilderStore((s) => s.createPlanningLine);

  const areaLines = getPlanningLinesByArea(selectedAreaName);

  const handleCreate = (name: string) => {
    createPlanningLine(selectedAreaName, name);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">קווי עבודה</h2>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          קו עבודה
        </button>
      </div>

      {areaLines.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-10 text-center">
          <ClipboardList size={48} className="text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-800 mb-2">אין קווי עבודה</h3>
          <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
            יש ליצור קווי עבודה ולשייך אליהן קבוצות עבודה ושורות מוצר.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            צור קו עבודה
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {areaLines.map((pl) => (
            <PlanningLineSection
              key={pl.id}
              planningLine={pl}
              orderItemMap={orderItemMap}
              onStartAssign={onStartAssign}
            />
          ))}
        </div>
      )}

      <PlanningLineCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
