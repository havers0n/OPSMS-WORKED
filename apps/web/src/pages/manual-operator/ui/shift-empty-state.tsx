interface ShiftEmptyStateProps {
  onCreateShift?: () => void;
  isCreating?: boolean;
  isToday: boolean;
}

export function ShiftEmptyState({ onCreateShift, isCreating, isToday }: ShiftEmptyStateProps) {
  const isPastDate = !isToday;

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] px-8 gap-6 text-center" dir="rtl">
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-3xl">
          {isPastDate ? '-' : '+'}
        </div>
        <h2 className="font-bold text-xl text-gray-900">ЧђЧ™Чџ ЧћЧ©ЧћЧЁЧЄ</h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          {isPastDate
            ? 'ЧњЧђ Ч ЧћЧ¦ЧђЧ” ЧћЧ©ЧћЧЁЧЄ ЧњЧЄЧђЧЁЧ™Чљ Ч–Ч”. Ч¦Ч•ЧЁ ЧђЧ• Ч¤ЧЄЧ— ЧћЧ©ЧћЧЁЧЄ ЧњЧ¤Ч Ч™ Ч™Ч™Ч‘Ч•Чђ Ч§Ч•Ч‘ЧҐ Ч”ЧђЧ§ЧЎЧњ.'
            : 'ЧђЧ™Чџ ЧћЧ©ЧћЧЁЧЄ Ч¤ЧЄЧ•Ч—Ч” ЧњЧ”Ч™Ч•Чќ. Ч¤ЧЄЧ— ЧћЧ©ЧћЧЁЧЄ Ч›Ч“Ч™ ЧњЧ”ЧЄЧ—Ч™Чњ Ч‘ЧЄЧ•ЧЁ.'}
        </p>
      </div>

      {onCreateShift && (
        <button
          aria-label={isPastDate ? 'פתח משמרת לתאריך זה' : 'פתח משמרת להיום'}
          onClick={onCreateShift}
          disabled={isCreating}
          className="w-full max-w-xs bg-gray-900 text-white font-bold py-4 px-6 rounded-2xl active:scale-95 transition-transform disabled:opacity-50 text-lg"
        >
          {isCreating
            ? 'Ч¤Ч•ЧЄЧ— ЧћЧ©ЧћЧЁЧЄ...'
            : isPastDate
              ? 'Ч¤ЧЄЧ— ЧћЧ©ЧћЧЁЧЄ ЧњЧЄЧђЧЁЧ™Чљ Ч–Ч”'
              : 'Ч¤ЧЄЧ— ЧћЧ©ЧћЧЁЧЄ ЧњЧ”Ч™Ч•Чќ'}
        </button>
      )}
    </div>
  );
}
