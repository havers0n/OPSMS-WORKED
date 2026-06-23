import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { PlanningLine, SourceOrderItem } from './scheme-types';
import { useSchemeBuilderStore } from './scheme-store';
import { WorkGroupCard } from './work-group-card';
import { WorkGroupCreateModal } from './work-group-create-modal';

export function PlanningLineSection({
  planningLine,
  orderItemMap,
  onStartAssign,
}: {
  planningLine: PlanningLine;
  orderItemMap: Record<string, SourceOrderItem[]>;
  onStartAssign: (workGroupId: string) => void;
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
    <div className="border border-gray-200 rounded-lg">
      <div className="bg-gray-100 px-2 py-1.5 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-indigo-500 block shrink-0" />
          {isRenaming ? (
            <input
              autoFocus
              className="border border-gray-300 rounded px-2 py-0.5 text-sm font-bold w-36 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setIsRenaming(false); }}
              dir="rtl"
            />
          ) : (
            <h3
              className="text-sm font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
              onClick={() => { setRenameValue(planningLine.name); setIsRenaming(true); }}
              title="לחץ לשינוי שם"
            >
              {planningLine.name}
            </h3>
          )}
          <span className="text-[11px] text-gray-400">קו עבודה</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Plus size={12} />
            קבוצת עבודה
          </button>
          <button
            type="button"
            onClick={handleDeleteClick}
            className="text-gray-400 hover:text-red-600 transition-colors p-1"
            title="מחק קו עבודה"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="p-2">
        {lineGroups.length === 0 ? (
          <div className="text-center py-2">
            <p className="text-xs text-gray-500 mb-2">אין קבוצות עבודה בקו זה</p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <Plus size={12} />
              צור קבוצת עבודה
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5">
            {lineGroups.map((wg) => (
              <WorkGroupCard
                key={wg.id}
                workGroup={wg}
                orderItemMap={orderItemMap}
                onStartAssign={onStartAssign}
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
