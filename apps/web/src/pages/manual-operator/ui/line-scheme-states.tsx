import { AlertCircle, Loader2, SplitSquareVertical } from 'lucide-react';

export function LoadingState() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]" dir="rtl">
      <Loader2 size={32} className="animate-spin text-gray-400" />
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center min-h-[40vh]" dir="rtl">
      <div className="text-center">
        <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
        <p className="text-red-600 font-medium">שגיאה בטעינת נתונים</p>
        <p className="text-gray-500 text-sm mt-1">{message}</p>
      </div>
    </div>
  );
}

export function EmptyOrdersState() {
  return (
    <div className="flex items-center justify-center min-h-[40vh] text-gray-500 text-sm" dir="rtl">
      אין הזמנות להצגה
    </div>
  );
}

export function EmptyWorkLinesState({ orderCount }: { orderCount: number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-300 border-dashed p-12 text-center">
      <SplitSquareVertical size={64} className="text-gray-300 mx-auto mb-4" />
      <h3 className="text-xl font-bold text-gray-800 mb-2">אין קווי עבודה</h3>
      <p className="text-gray-500 mb-6 max-w-md mx-auto text-sm">
        המערכת מצאה {orderCount} הזמנות.
        יש להגדיר קווי עבודה דרך הייבוא החודשי.
      </p>
    </div>
  );
}
