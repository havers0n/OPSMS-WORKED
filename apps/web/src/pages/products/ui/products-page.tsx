import { useMemo, useState } from 'react';
import { Package, Search } from 'lucide-react';

type ProductStatus = 'active' | 'inactive';

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  barcode: string;
  status: ProductStatus;
  primaryCells: number;
  reserveCells: number;
  onHandQty: number;
};

const demoProducts: ProductRow[] = [
  {
    id: 'p-1',
    sku: 'SKU-10014',
    name: 'Industrial Gloves XL',
    barcode: '4810001001408',
    status: 'active',
    primaryCells: 2,
    reserveCells: 5,
    onHandQty: 940
  },
  {
    id: 'p-2',
    sku: 'SKU-10017',
    name: 'Shrink Film 500mm',
    barcode: '4810001001712',
    status: 'active',
    primaryCells: 1,
    reserveCells: 3,
    onHandQty: 420
  },
  {
    id: 'p-3',
    sku: 'SKU-10031',
    name: 'Pallet Label A6',
    barcode: '4810001003181',
    status: 'inactive',
    primaryCells: 0,
    reserveCells: 1,
    onHandQty: 0
  }
];

export function ProductsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProductStatus>('all');

  const filteredRows = useMemo(() => {
    return demoProducts.filter((product) => {
      const query = search.trim().toLowerCase();
      const matchesQuery =
        query.length === 0 ||
        product.sku.toLowerCase().includes(query) ||
        product.name.toLowerCase().includes(query) ||
        product.barcode.toLowerCase().includes(query);

      const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [search, statusFilter]);

  const activeCount = demoProducts.filter((product) => product.status === 'active').length;

  return (
    <section className="flex h-full flex-col gap-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Product Registry</h1>
            <p className="mt-1 text-sm text-slate-500">Master data, location roles, and stock visibility in one place.</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-cyan-500"
          >
            <Package className="h-4 w-4" />
            Add product
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total products</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{demoProducts.length}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Active</p>
            <p className="mt-1 text-xl font-semibold text-emerald-700">{activeCount}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Visible rows</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{filteredRows.length}</p>
          </article>
        </div>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <label className="relative min-w-[250px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by SKU, name, or barcode"
              className="h-10 w-full rounded-xl border border-slate-300 pl-9 pr-3 text-sm outline-none transition focus:border-cyan-500"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | ProductStatus)}
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-cyan-500"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Barcode</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Primary / Reserve</th>
                <th className="px-4 py-3 text-right">On hand qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((product) => (
                <tr key={product.id} className="text-slate-700">
                  <td className="px-4 py-3 font-medium text-slate-900">{product.sku}</td>
                  <td className="px-4 py-3">{product.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{product.barcode}</td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
                        product.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-600'
                      ].join(' ')}
                    >
                      {product.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {product.primaryCells} / {product.reserveCells}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">{product.onHandQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
