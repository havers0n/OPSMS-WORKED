import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import type { SourceOrder, SourceOrderItem } from './scheme-types';
import { useSchemeBuilderStore } from './scheme-store';

export function PublishSummary({
  orders,
  orderItemMap,
}: {
  orders: SourceOrder[];
  orderItemMap: Record<string, SourceOrderItem[]>;
}) {
  const workGroups = useSchemeBuilderStore((s) => s.workGroups);
  const itemAssignments = useSchemeBuilderStore((s) => s.itemAssignments);

  const totalItemRows = Object.values(orderItemMap).reduce((acc, items) => acc + items.length, 0);
  const assignedCount = Object.keys(itemAssignments).length;
  const unassignedCount = totalItemRows - assignedCount;
  const groupCount = workGroups.length;

  const allAssigned = unassignedCount === 0 && groupCount > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-bold text-gray-700">סיכום נכונות</h3>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-gray-50 rounded p-2.5 text-center">
          <div className="font-bold text-gray-900 text-lg">{groupCount}</div>
          <div className="text-xs text-gray-500">קבוצות עבודה</div>
        </div>
        <div className="bg-gray-50 rounded p-2.5 text-center">
          <div className="font-bold text-gray-900 text-lg">{orders.length}</div>
          <div className="text-xs text-gray-500">הזמנות</div>
        </div>
        <div className="bg-gray-50 rounded p-2.5 text-center">
          <div className="font-bold text-gray-900 text-lg">{assignedCount}</div>
          <div className="text-xs text-gray-500">שורות משויכות</div>
        </div>
        <div className="bg-gray-50 rounded p-2.5 text-center">
          <div className={`font-bold text-lg ${unassignedCount > 0 ? 'text-amber-700' : 'text-green-700'}`}>{unassignedCount}</div>
          <div className="text-xs text-gray-500">שורות לא משויכות</div>
        </div>
      </div>

      <div className={`flex items-center gap-2 text-sm rounded p-2.5 ${
        allAssigned ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'
      }`}>
        {allAssigned ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
        {allAssigned ? 'כל השורות שובצו' : `נותרו ${unassignedCount} שורות שלא שובצו`}
      </div>

      <button
        type="button"
        disabled
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md bg-gray-200 text-gray-500 cursor-not-allowed"
        title="פרסום יגיע בשלב הבא"
      >
        <Clock size={16} />
        פרסום יגיע בשלב הבא
      </button>

      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 font-medium">
        טיוטה מקומית בלבד — שמירה תגיע בשלב הבא
      </div>
    </div>
  );
}
