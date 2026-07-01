import { useState } from 'react';
import { useSchemeBuilderStore } from './scheme-store';
import { getVisiblePlanningLines, getVisibleWorkGroups } from './scheme-display-utils';

export function AssignModalV2({
  isOpen,
  onClose,
  targetAreaName,
  itemCount,
  onAssign,
}: {
  isOpen: boolean;
  onClose: () => void;
  targetAreaName: string | null;
  itemCount: number;
  onAssign: (workGroupId: string) => void;
}) {
  const [selectedWgId, setSelectedWgId] = useState<string | null>(null);

  const planningLines = useSchemeBuilderStore((s) => s.planningLines);
  const getWorkGroupsByPlanningLine = useSchemeBuilderStore((s) => s.getWorkGroupsByPlanningLine);

  const areaLines = getVisiblePlanningLines(
    targetAreaName
      ? planningLines.filter((pl) => pl.areaName === targetAreaName)
      : planningLines,
  );

  const handleAssign = () => {
    if (!selectedWgId) return;
    onAssign(selectedWgId);
    setSelectedWgId(null);
    onClose();
  };

  const handleClose = () => {
    setSelectedWgId(null);
    onClose();
  };

  if (!isOpen) return null;

  const totalGroups = areaLines.reduce(
    (acc, pl) => acc + getVisibleWorkGroups(getWorkGroupsByPlanningLine(pl.id)).length,
    0,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={handleClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">שייך לקבוצת עבודה</h2>
          <p className="text-sm text-gray-500 mt-1">{itemCount} שורות מסומנות</p>
        </div>

        <div className="px-6 py-4 max-h-72 overflow-y-auto">
          {areaLines.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-4">
              יש ליצור קו עבודה וקבוצת עבודה לפני שיוך שורות
            </div>
          ) : totalGroups === 0 ? (
            <div className="text-sm text-gray-500 text-center py-4">
              יש ליצור קבוצת עבודה לפני שיוך שורות
            </div>
          ) : (
            <div className="space-y-4">
              {areaLines.map((pl) => {
                const lineGroups = getVisibleWorkGroups(getWorkGroupsByPlanningLine(pl.id));
                if (lineGroups.length === 0) return null;
                return (
                  <div key={pl.id}>
                    <div className="text-xs font-bold text-gray-500 mb-2">{pl.name}</div>
                    <div className="grid grid-cols-2 gap-2">
                      {lineGroups.map((wg) => (
                        <button
                          key={wg.id}
                          type="button"
                          onClick={() => setSelectedWgId(wg.id)}
                          className={`rounded-lg border px-3 py-3 text-sm font-medium transition-colors text-center ${
                            selectedWgId === wg.id
                              ? 'bg-blue-50 border-blue-500 text-blue-900'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'
                          }`}
                        >
                          {wg.name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleAssign}
            disabled={!selectedWgId}
            className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            שייך
          </button>
        </div>
      </div>
    </div>
  );
}
