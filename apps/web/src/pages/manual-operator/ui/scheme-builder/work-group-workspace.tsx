import { useState } from 'react';
import { Plus } from 'lucide-react';
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
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-900">קווי עבודה</h2>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <Plus size={14} />
          קו עבודה
        </button>
      </div>

      {areaLines.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-6 text-center">
          <p className="text-sm text-gray-500 mb-3">
            יש ליצור קווי עבודה ולשייך אליהן קבוצות עבודה ושורות מוצר.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            צור קו עבודה
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
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
