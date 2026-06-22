import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { SourceOrder, SourceOrderItem } from './scheme-types';
import { useSchemeBuilderStore } from './scheme-store';

export function ProblemQueue({
  orders,
  orderItemMap,
}: {
  orders: SourceOrder[];
  orderItemMap: Record<string, SourceOrderItem[]>;
}) {
  const itemAssignments = useSchemeBuilderStore((s) => s.itemAssignments);

  const unassignedOrders: SourceOrder[] = [];
  const partialOrders: SourceOrder[] = [];
  const splitOrders: SourceOrder[] = [];
  const ashlamaOrders: SourceOrder[] = [];
  const checkUnitOrders: SourceOrder[] = [];

  for (const order of orders) {
    const itemIds = (orderItemMap[order.orderId] ?? []).map((i) => i.id);
    if (itemIds.length === 0) continue;

    let assignedCount = 0;
    const groups = new Set<string>();
    for (const itemId of itemIds) {
      const wgId = itemAssignments[itemId];
      if (wgId) {
        assignedCount++;
        groups.add(wgId);
      }
    }

    if (assignedCount === 0) {
      unassignedOrders.push(order);
    } else if (assignedCount < itemIds.length) {
      partialOrders.push(order);
    } else if (groups.size > 1) {
      splitOrders.push(order);
    }

    if (order.hasAshlama) ashlamaOrders.push(order);
    if (order.hasCheckUnits) checkUnitOrders.push(order);
  }

  const problems: { icon: typeof AlertCircle; tone: string; title: string; count: number; detail: string }[] = [];

  if (unassignedOrders.length > 0) {
    problems.push({
      icon: AlertCircle,
      tone: 'red',
      title: 'הזמנות ללא שיוך',
      count: unassignedOrders.length,
      detail: `${unassignedOrders.length} הזמנות עם שורות שלא שובצו לאף קבוצה`,
    });
  }

  if (partialOrders.length > 0) {
    problems.push({
      icon: AlertTriangle,
      tone: 'amber',
      title: 'הזמנות בשיוך חלקי',
      count: partialOrders.length,
      detail: `${partialOrders.length} הזמנות שחלק משורותיהן שובצו וחלק לא`,
    });
  }

  if (splitOrders.length > 0) {
    problems.push({
      icon: Info,
      tone: 'blue',
      title: 'הזמנות מפוצלות',
      count: splitOrders.length,
      detail: `${splitOrders.length} הזמנות שהשורות שלהן מפוצלות בין מספר קבוצות עבודה`,
    });
  }

  if (ashlamaOrders.length > 0) {
    problems.push({
      icon: AlertTriangle,
      tone: 'amber',
      title: 'הזמנות עם אשלמה',
      count: ashlamaOrders.length,
      detail: `${ashlamaOrders.length} הזמנות עם אשלמה פתוחה`,
    });
  }

  if (checkUnitOrders.length > 0) {
    problems.push({
      icon: AlertTriangle,
      tone: 'amber',
      title: 'הזמנות עם יחידות בדיקה',
      count: checkUnitOrders.length,
      detail: `${checkUnitOrders.length} הזמנות עם יחידות בדיקה`,
    });
  }

  if (problems.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 font-medium">
        אין בעלות — התכנית מוכנה
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-bold text-gray-700">בעיות נכונות מקומית</h3>
      {problems.map((p, i) => {
        const Icon = p.icon;
        const borderColor =
          p.tone === 'red' ? 'border-red-200 bg-red-50' :
          p.tone === 'amber' ? 'border-amber-200 bg-amber-50' :
          'border-blue-200 bg-blue-50';
        const textColor =
          p.tone === 'red' ? 'text-red-800' :
          p.tone === 'amber' ? 'text-amber-800' :
          'text-blue-800';
        return (
          <div key={i} className={`rounded-lg border ${borderColor} px-4 py-3`}>
            <div className={`flex items-center gap-2 font-semibold text-sm ${textColor}`}>
              <Icon size={16} />
              {p.title} ({p.count})
            </div>
            <div className="text-xs text-gray-600 mt-1">{p.detail}</div>
          </div>
        );
      })}
    </div>
  );
}
