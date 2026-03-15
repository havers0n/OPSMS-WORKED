import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, RefreshCw, Search } from 'lucide-react';
import { productCatalogQueryOptions } from '@/entities/product/api/queries';

const pageSize = 50;

export function ProductsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const { data, isLoading, isFetching, refetch } = useQuery(
    productCatalogQueryOptions({
      query: search,
      page,
      pageSize
    })
  );

  const products = data?.items ?? [];
  const total = data?.total ?? 0;
  const activeTotal = data?.activeTotal ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageStart = total === 0 ? 0 : page * pageSize + 1;
  const pageEnd = total === 0 ? 0 : Math.min((page + 1) * pageSize, total);

  return (
    <section className="flex h-full flex-col gap-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Product Catalog</h1>
            <p className="mt-1 text-sm text-slate-500">
              Read-only catalog used by operators when building order lines from existing products.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total products</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{total}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Active</p>
            <p className="mt-1 text-xl font-semibold text-emerald-700">{activeTotal}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Visible rows</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{products.length}</p>
          </article>
        </div>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <label className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder="Search by SKU, name, or external product id"
              className="h-10 w-full rounded-xl border border-slate-300 pl-9 pr-3 text-sm outline-none transition focus:border-cyan-500"
            />
          </label>
          <div className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-medium text-cyan-800">
            <Package className="h-4 w-4" />
            Catalog page is paginated, picker search stays top-20
          </div>
        </div>

        <div className="overflow-auto">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <RefreshCw className="h-5 w-5 animate-spin text-slate-300" />
            </div>
          ) : products.length === 0 ? (
            <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-slate-500">
              No products match this query.
            </div>
          ) : (
            <>
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">External id</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((product) => (
                    <tr key={product.id} className="text-slate-700">
                      <td className="px-4 py-3 font-medium text-slate-900">{product.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{product.sku ?? '-'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{product.externalProductId}</td>
                      <td className="px-4 py-3 text-slate-600">{product.source}</td>
                      <td className="px-4 py-3">
                        <span
                          className={[
                            'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
                            product.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                          ].join(' ')}
                        >
                          {product.isActive ? 'active' : 'inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{new Date(product.updatedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
                <div>
                  Showing {pageStart}-{pageEnd} of {total}
                  {search.trim().length > 0 ? ` for "${search.trim()}"` : ''}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                    disabled={page === 0 || isFetching}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-slate-500">
                    Page {Math.min(page + 1, totalPages)} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((current) => (pageEnd < total ? current + 1 : current))}
                    disabled={pageEnd >= total || isFetching}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
