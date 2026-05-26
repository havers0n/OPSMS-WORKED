import { useState } from 'react';
import { X } from 'lucide-react';
import { useCreateLine } from '@/entities/manual-shift/api/mutations';

interface AddLineSheetProps {
  shiftId: string;
  onClose: () => void;
}

export function AddLineSheet({ shiftId, onClose }: AddLineSheetProps) {
  const [name, setName] = useState('');
  const createLine = useCreateLine(shiftId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createLine.mutate({ name: name.trim() }, { onSuccess: onClose });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" dir="rtl">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-[430px] bg-white rounded-t-2xl shadow-2xl p-6 pb-8 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-lg text-gray-900">הוסף קו חדש</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
            aria-label="סגור"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="שם הקו (למשל: מרכז, צפון...)"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-4 py-3 min-h-[48px] text-base"
            autoFocus
            dir="rtl"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white border border-gray-300 text-gray-700 font-medium py-3 rounded-xl active:bg-gray-50 transition-colors"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={!name.trim() || createLine.isPending}
              className="flex-1 bg-gray-900 text-white font-medium py-3 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
            >
              {createLine.isPending ? 'שומר...' : 'הוסף'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
