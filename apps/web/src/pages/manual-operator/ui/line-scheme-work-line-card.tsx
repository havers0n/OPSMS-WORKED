import type { LineSchemeOrder, LineSchemeWorkLine } from './line-scheme-types';

export function WorkLineCard({
  line,
  allOrders,
}: {
  line: LineSchemeWorkLine;
  allOrders: LineSchemeOrder[];
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="bg-gray-100 p-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500 block shrink-0" />
            {line.lineGroupName}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {line.totalOrders} הזמנות &middot; כמות {line.totalQuantity}
          </p>
          {line.distributionArea && (
            <p className="text-xs text-gray-500 mt-0.5">איזור הפצה: {line.distributionArea}</p>
          )}
        </div>
      </div>

      <div className="p-4 bg-white flex flex-wrap gap-3 items-start">
        {line.buckets.map(bucket => {
          const bucketOrders = allOrders.filter(o => o.localAssignment?.assignedBucketKey === bucket.bucketKey);
          const bucketQty = bucketOrders.reduce((s, o) => s + o.totalQuantity, 0);
          return (
            <div
              key={bucket.bucketKey}
              className="border border-gray-200 rounded-lg p-3 w-56 shadow-sm hover:border-blue-300 transition-colors"
            >
              <div className="font-semibold text-gray-900 text-sm">{bucket.displayName}</div>
              <div className="text-xs text-gray-500 mt-1">
                {bucket.totalOrders} הזמנות &middot; כמות {bucket.totalQuantity}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                {bucketOrders.length} משויכות &middot; כמות {bucketQty}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {bucketOrders.slice(0, 4).map(o => (
                  <span key={o.orderId} className="text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5 truncate max-w-[120px]">
                    {o.orderNumber}
                  </span>
                ))}
                {bucketOrders.length > 4 && (
                  <span className="text-xs text-gray-500">+{bucketOrders.length - 4}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
