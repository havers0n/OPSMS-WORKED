import { useState } from 'react';
import { Plus, Trash2, PackageOpen } from 'lucide-react';
import type { PlanningLine, SourceOrderItem } from './scheme-types';
import { useSchemeBuilderStore } from './scheme-store';
import { WorkGroupCard } from './work-group-card';
import { WorkGroupCreateModal } from './work-group-create-modal';

export function PlanningLineSection({
  planningLine,
  orderItemMap,
  onOpenAssignModal,
}: {
  planningLine: PlanningLine;
  orderItemMap: Record<string, SourceOrderItem[]>;
  onOpenAssignModal: () => void;
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(planningLine.name);

  const workGroups = useSchemeBuilderStore((s) => s.workGroups);
  const createWorkGroup = useSchemeBuilderStore((s) => s.createWorkGroup);
  const renamePlanningLine = useSchemeBuilderStore((s) => s.renamePlanningLine);
  const deletePlanningLine = useSchemeBuilderStore((s) => s.deletePlanningLine);

  const lineGroups = workGroups.filter((wg) => wg.planningLineId === planningLine.id);

  const handleCreateWorkGroup = (name: string) => {
    createWorkGroup(planningLine.id, name);
  };

  const handleRename = () => {
    if (renameValue.trim() && renameValue.trim() !== planningLine.name) {
      renamePlanningLine(planningLine.id, renameValue.trim());
    }
    setIsRenaming(false);
  };

  const handleDelete = () => {
    const result = deletePlanningLine(planningLine.id);
    if (!result.ok && result.reason === 'has_work_groups') {
      alert('לא ניתן למחוק קו עבודה שיש בו קבוצות עבודה');
    }
  };

  const handleDeleteClick = () => {
    if (lineGroups.length > 0) {
      alert('לא ניתן למחוק קו עבודה שיש בו קבוצות עבודה');
      return;
    }
    if (window.confirm('האם למחוק את קו העבודה?')) {
      handleDelete();
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-3 h-3 rounded-full bg-indigo-500 block shrink-0" />
          {isRenaming ? (
            <input
              autoFocus
              className="border border-gray-300 rounded px-2 py-1 text-sm font-bold w-48 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setIsRenaming(false); }}
              dir="rtl"
            />
          ) : (
            <h3
              className="text-base font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
              onClick={() => { setRenameValue(planningLine.name); setIsRenaming(true); }}
              title="לחץ לשינוי שם"
            >
              {planningLine.name}
            </h3>
          )}
          <span className="text-xs text-gray-400">קו עבודה</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            קבוצת עבודה
          </button>
          <button
            type="button"
            onClick={handleDeleteClick}
            className="text-gray-400 hover:text-red-600 transition-colors p-1"
            title="מחק קו עבודה"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="p-4">
        {lineGroups.length === 0 ? (
          <div className="text-center py-6">
            <PackageOpen size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 mb-3">אין קבוצות עבודה בקו זה</p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} />
              צור קבוצת עבודה
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lineGroups.map((wg) => (
              <WorkGroupCard
                key={wg.id}
                workGroup={wg}
                orderItemMap={orderItemMap}
                onAssignItems={onOpenAssignModal}
              />
            ))}
          </div>
        )}
      </div>

      <WorkGroupCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateWorkGroup}
      />
    </div>
  );
}
