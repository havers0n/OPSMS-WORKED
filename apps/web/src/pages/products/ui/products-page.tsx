import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, RefreshCw, Search } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { productCatalogQueryOptions } from '@/entities/product/api/queries';
import { productDetailPath } from '@/shared/config/routes';

const pageSize = 50;

export function ProductsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
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
  const returnTo = `${location.pathname}${location.search}`;

  function openProduct(productId: string) {
    navigate(productDetailPath(productId), { state: { from: returnTo } });
  }

  return (
    <section className="flex h-full w-full flex-1 overflow-hidden">
      <div className="m-4 flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Product Catalog</h1>
              <p className="mt-1 text-sm text-slate-500">
                Search products by SKU, name, or external product ID.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="text-slate-500">Total</span>
              <span className="font-semibold text-slate-900">{total}</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500">Active</span>
              <span className="font-semibold text-emerald-700">{activeTotal}</span>
            </div>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3">
          <label className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder="Search by SKU, name, or external product id"
              className="h-9 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none transition focus:border-cyan-500"
            />
          </label>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="flex-1 overflow-auto">
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
                    <th className="w-[32%] px-5 py-2.5">Name</th>
                    <th className="w-[14%] px-4 py-2.5">SKU</th>
                    <th className="w-[18%] px-4 py-2.5">External id</th>
                    <th className="w-[14%] px-4 py-2.5">Source</th>
                    <th className="w-[10%] px-4 py-2.5">Status</th>
                    <th className="w-[11%] px-4 py-2.5">Updated</th>
                    <th className="w-[1%] px-4 py-2.5 text-right">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      className="cursor-pointer text-slate-700 transition hover:bg-slate-50"
                      onClick={() => openProduct(product.id)}
                    >
                      <td className="px-5 py-2.5 font-medium text-slate-900">{product.name}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-600">
                        {product.sku ?? '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-500">
                        {product.externalProductId}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{product.source}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={[
                            'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
                            product.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                          ].join(' ')}
                        >
                          {product.isActive ? 'active' : 'inactive'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">
                        {new Date(product.updatedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          to={productDetailPath(product.id)}
                          state={{ from: returnTo }}
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-cyan-700 hover:bg-cyan-50"
                        >
                          Open
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm text-slate-600">
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
