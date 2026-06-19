import type { BucketProductRollupRow } from '@wos/domain';

interface DesktopBucketProductTableProps {
  products: BucketProductRollupRow[];
}

export function DesktopBucketProductTable({ products }: DesktopBucketProductTableProps) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 px-4 gap-1">
        <p className="text-sm font-medium text-gray-500">אין מוצרים בקבוצת עבודה זו</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-right" data-testid="bucket-product-table">
        <thead>
          <tr className="border-b border-gray-200 text-xs text-gray-500">
            <th className="py-2 px-3 font-medium">מק"ט</th>
            <th className="py-2 px-3 font-medium">תיאור</th>
            <th className="py-2 px-3 font-medium">קטגוריה</th>
            <th className="py-2 px-3 font-medium text-left">כמות</th>
            <th className="py-2 px-3 font-medium text-left">הזמנות</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr
              key={product.sku}
              className="border-b border-gray-100 hover:bg-gray-50"
              data-testid={`product-row-${product.sku}`}
            >
              <td className="py-2 px-3 text-gray-900 font-medium">{product.sku}</td>
              <td className="py-2 px-3 text-gray-700">{product.description ?? '—'}</td>
              <td className="py-2 px-3 text-gray-500">{product.category ?? '—'}</td>
              <td className="py-2 px-3 text-left tabular-nums">{product.totalQuantity}</td>
              <td className="py-2 px-3 text-left">{product.orderCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
