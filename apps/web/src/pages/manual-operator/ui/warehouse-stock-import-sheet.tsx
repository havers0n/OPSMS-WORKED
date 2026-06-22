import { X } from 'lucide-react';
import { WarehouseStockImportPanel } from './warehouse-stock-import-panel';

interface WarehouseStockImportSheetProps {
  shiftId?: string | null;
  selectedDate?: string | null;
  onClose: () => void;
}

export function WarehouseStockImportSheet({ shiftId, selectedDate, onClose }: WarehouseStockImportSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" dir="rtl">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative flex h-[100dvh] w-full max-w-[430px] flex-col bg-white">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white p-4">
          <h2 className="text-lg font-bold text-gray-900">ייבוא מלאי מחסן</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500"
            aria-label="סגור"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <WarehouseStockImportPanel shiftId={shiftId} selectedDate={selectedDate} />
        </div>
      </div>
    </div>
  );
}
