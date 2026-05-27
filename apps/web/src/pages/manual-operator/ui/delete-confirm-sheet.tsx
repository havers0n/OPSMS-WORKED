import { useState } from 'react';
import { ArrowRight, TriangleAlert } from 'lucide-react';

interface DeleteConfirmSheetProps {
  confirmLabel: string;
  description: string;
  isPending: boolean;
  title: string;
  onClose: () => void;
  onConfirm: (reason?: string) => void | Promise<void>;
}

export function DeleteConfirmSheet({
  confirmLabel,
  description,
  isPending,
  title,
  onClose,
  onConfirm
}: DeleteConfirmSheetProps) {
  const [reason, setReason] = useState('');

  function handleConfirm() {
    void onConfirm(reason.trim() || undefined);
  }

  return (
    <div className="absolute inset-0 z-30 bg-white flex flex-col pb-16" dir="rtl">
      <header className="flex items-center gap-4 p-4 border-b border-gray-200 bg-gray-50 shrink-0">
        <button
          onClick={onClose}
          className="p-2 -m-2 rounded-full active:bg-gray-200 transition-colors text-gray-500"
          aria-label="סגור אישור מחיקה"
        >
          <ArrowRight size={24} />
        </button>
        <h2 className="font-bold text-xl flex-1 text-gray-900">{title}</h2>
      </header>

      <main className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 text-right">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex gap-3">
          <TriangleAlert className="text-red-600 shrink-0" size={20} />
          <p className="text-sm leading-6 text-red-900">{description}</p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-bold text-gray-700" htmlFor="delete-reason">
            סיבה למחיקה (אופציונלי)
          </label>
          <textarea
            id="delete-reason"
            className="w-full bg-gray-50 border border-gray-300 rounded-xl p-4 text-base"
            rows={4}
            placeholder="אפשר להוסיף הסבר קצר למחיקה"
            value={reason}
            onChange={event => setReason(event.target.value)}
          />
        </div>
      </main>

      <footer className="shrink-0 border-t border-gray-200 bg-white p-4 flex gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="flex-1 h-14 rounded-xl border border-gray-300 font-bold text-gray-700 disabled:opacity-50"
        >
          ביטול
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isPending}
          className="flex-1 h-14 rounded-xl bg-red-600 text-white font-bold disabled:opacity-50"
        >
          {isPending ? 'שומר...' : confirmLabel}
        </button>
      </footer>
    </div>
  );
}
