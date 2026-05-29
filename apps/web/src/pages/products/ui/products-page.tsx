import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronRight, Plus, RefreshCw, Search, Tag, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { productCatalogQueryOptions, productCategoriesQueryOptions } from '@/entities/product/api/queries';
import {
  useBulkSetProductCategory,
  useCreateProductCategory
} from '@/entities/product/api/mutations';
import { productDetailPath } from '@/shared/config/routes';
import { useT } from '@/shared/i18n';

const pageSize = 50;

export function ProductsPage() {
  const t = useT();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [category, setCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const { data: categoriesData } = useQuery(productCategoriesQueryOptions());
  const categories = categoriesData ?? [];

  const createCategoryMutation = useCreateProductCategory();
  const bulkSetMutation = useBulkSetProductCategory();

  const { data, isLoading, isFetching, refetch } = useQuery(
    productCatalogQueryOptions({ query: search, page, pageSize, category })
  );

  const products = data?.items ?? [];
  const total = data?.total ?? 0;
  const activeTotal = data?.activeTotal ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageStart = total === 0 ? 0 : page * pageSize + 1;
  const pageEnd = total === 0 ? 0 : Math.min((page + 1) * pageSize, total);
  const returnTo = `${location.pathname}${location.search}`;

  const allPageSelected = products.length > 0 && products.every((p) => selected.has(p.id));
  const somePageSelected = products.some((p) => selected.has(p.id));

  function openProduct(productId: string) {
    navigate(productDetailPath(productId), { state: { from: returnTo } });
  }

  function selectCategory(cat: string | null) {
    setCategory(cat);
    setPage(0);
    setSelected(new Set());
  }

  function toggleProduct(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        products.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        products.forEach((p) => next.add(p.id));
        return next;
      });
    }
  }

  function clearSelection() {
    setSelected(new Set());
    setBulkCategory('');
  }

  async function applyBulkCategory() {
    if (!bulkCategory || selected.size === 0) return;
    await bulkSetMutation.mutateAsync({
      productIds: [...selected],
      category: bulkCategory
    });
    clearSelection();
    void refetch();
  }

  function openAddCategory() {
    setAddingCategory(true);
    setNewCategoryName('');
    setTimeout(() => addInputRef.current?.focus(), 0);
  }

  async function saveNewCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    await createCategoryMutation.mutateAsync(name);
    setAddingCategory(false);
    setNewCategoryName('');
  }

  function cancelAddCategory() {
    setAddingCategory(false);
    setNewCategoryName('');
  }

  return (
    <section className="flex h-full w-full flex-1 overflow-hidden">
      <div className="m-4 flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        {/* Header */}
        <header className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">{t('products.title')}</h1>
              <p className="mt-1 text-sm text-slate-500">{t('products.subtitle')}</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="text-slate-500">{t('products.stats.total')}</span>
              <span className="font-semibold text-slate-900">{total}</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500">{t('products.stats.active')}</span>
              <span className="font-semibold text-emerald-700">{activeTotal}</span>
            </div>
          </div>
        </header>

        {/* Category tabs */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 px-5 scrollbar-none">
          <button
            type="button"
            onClick={() => selectCategory(null)}
            className={[
              'whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors',
              category === null
                ? 'border-cyan-500 text-cyan-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            ].join(' ')}
          >
            {t('products.category.all')}
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => selectCategory(cat.name)}
              className={[
                'whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                category === cat.name
                  ? 'border-cyan-500 text-cyan-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              ].join(' ')}
            >
              {cat.name}
            </button>
          ))}

          {addingCategory ? (
            <div className="ml-2 flex items-center gap-1 py-2">
              <input
                ref={addInputRef}
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveNewCategory();
                  if (e.key === 'Escape') cancelAddCategory();
                }}
                placeholder={t('products.category.addPlaceholder')}
                className="h-7 w-40 rounded-md border border-slate-300 px-2 text-sm outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={() => void saveNewCategory()}
                disabled={createCategoryMutation.isPending || !newCategoryName.trim()}
                className="h-7 rounded-md bg-cyan-600 px-2.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                {t('products.category.save')}
              </button>
              <button
                type="button"
                onClick={cancelAddCategory}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openAddCategory}
              className="ml-2 flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('products.category.addButton')}
            </button>
          )}
        </div>

        {/* Search + Refresh */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3">
          <label className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
                setSelected(new Set());
              }}
              placeholder={t('products.search.placeholder')}
              className="h-9 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none transition focus:border-cyan-500"
            />
          </label>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            {t('products.action.refresh')}
          </button>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 border-b border-cyan-100 bg-cyan-50 px-5 py-2.5">
            <Tag className="h-4 w-4 shrink-0 text-cyan-600" />
            <span className="text-sm font-medium text-cyan-900">
              Выбрано: {selected.size}
            </span>
            <div className="flex flex-1 items-center gap-2">
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                className="h-8 rounded-md border border-cyan-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-cyan-400"
              >
                <option value="">{t('products.category.select')}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void applyBulkCategory()}
                disabled={!bulkCategory || bulkSetMutation.isPending}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-cyan-600 px-3 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                {bulkSetMutation.isPending
                  ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  : <Check className="h-3.5 w-3.5" />}
                Применить
              </button>
            </div>
            <button
              type="button"
              onClick={clearSelection}
              className="flex h-7 w-7 items-center justify-center rounded-md text-cyan-600 hover:bg-cyan-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <RefreshCw className="h-5 w-5 animate-spin text-slate-300" />
            </div>
          ) : products.length === 0 ? (
            <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-slate-500">
              {t('products.empty')}
            </div>
          ) : (
            <>
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-[40px] px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        ref={(el) => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                        onChange={toggleAll}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 text-cyan-600"
                      />
                    </th>
                    <th className="w-[27%] px-3 py-2.5">{t('products.table.name')}</th>
                    <th className="w-[11%] px-4 py-2.5">{t('products.table.sku')}</th>
                    <th className="w-[13%] px-4 py-2.5">{t('products.table.category')}</th>
                    <th className="w-[15%] px-4 py-2.5">{t('products.table.externalId')}</th>
                    <th className="w-[10%] px-4 py-2.5">{t('products.table.status')}</th>
                    <th className="w-[11%] px-4 py-2.5">{t('products.table.updated')}</th>
                    <th className="w-[1%] px-4 py-2.5 text-right">{t('products.table.open')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((product) => {
                    const isSelected = selected.has(product.id);
                    return (
                      <tr
                        key={product.id}
                        className={[
                          'text-slate-700 transition',
                          isSelected ? 'bg-cyan-50' : 'hover:bg-slate-50'
                        ].join(' ')}
                      >
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleProduct(product.id)}
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-cyan-600"
                          />
                        </td>
                        <td
                          className="cursor-pointer px-3 py-2.5 font-medium text-slate-900"
                          onClick={() => openProduct(product.id)}
                        >
                          {product.name}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-600">
                          {product.sku ?? '-'}
                        </td>
                        <td className="px-4 py-2.5">
                          {product.category ? (
                            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                              {product.category}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">{t('products.category.none')}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-500">
                          {product.externalProductId}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={[
                            'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
                            product.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                          ].join(' ')}>
                            {product.isActive ? t('products.status.active') : t('products.status.inactive')}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">
                          {new Date(product.updatedAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Link
                            to={productDetailPath(product.id)}
                            state={{ from: returnTo }}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-cyan-700 hover:bg-cyan-50"
                          >
                            {t('products.table.open')}
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm text-slate-600">
                <div>
                  {search.trim().length > 0
                    ? t('products.pagination.showingQuery', { start: pageStart, end: pageEnd, total, query: search.trim() })
                    : t('products.pagination.showing', { start: pageStart, end: pageEnd, total })}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((c) => Math.max(0, c - 1))}
                    disabled={page === 0 || isFetching}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {t('products.pagination.previous')}
                  </button>
                  <span className="text-xs text-slate-500">
                    {t('products.pagination.page', { current: Math.min(page + 1, totalPages), total: totalPages })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((c) => (pageEnd < total ? c + 1 : c))}
                    disabled={pageEnd >= total || isFetching}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {t('products.pagination.next')}
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
