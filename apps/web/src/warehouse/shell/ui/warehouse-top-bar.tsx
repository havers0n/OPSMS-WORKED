import { Menu } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Product } from '@wos/domain';
import { useActiveFloorId, useIsDrawerCollapsed, useToggleDrawer } from '@/app/store/ui-selectors';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { floorCellsByProductQueryOptions } from '@/entities/location/api/queries';
import { productsSearchQueryOptions } from '@/entities/product/api/queries';
import { useFloorWorkspace } from '@/entities/layout-version/api/use-floor-workspace';
import { useLayoutValidation } from '@/features/layout-validate/model/use-layout-validation';
import { routes } from '@/shared/config/routes';
import { IconButton } from '@/shared/ui/icon-button';
import { TopBarShell } from '@/shared/ui/top-bar-shell';
import {
  useClearWarehouseHighlightedCells,
  useSetWarehouseHighlightedCells,
  useSetWarehouseSelectedCellId
} from '@/warehouse/state/interaction';
import {
  useIsWarehouseDraftDirty,
  useWarehouseDraftStatus,
  useWarehouseLayoutDraft
} from '@/warehouse/state/layout-draft';
import { warehouseStorageFocusActions } from '@/warehouse/state/storage-focus';
import { useWarehouseViewMode } from '@/warehouse/state/view-mode';
import { AccountControls } from '@/widgets/app-shell/ui/account-controls';
import { ViewModeSwitcher } from './view-mode-switcher';
import { WorkspaceActions } from './workspace-actions';
import { WorkspaceNav } from './workspace-nav';
import { WorkspaceStatus } from './workspace-status';

type LocateFeedback = {
  kind: 'idle' | 'found' | 'not-found' | 'invalid' | 'error';
  message: string | null;
};

type LocateMode = 'address' | 'product';

function normalizeLocateToken(value: string): string {
  return value.trim().toUpperCase().replace(/[\s\-_./:]+/g, '');
}

function WarehouseViewLocateInline() {
  const [mode, setMode] = useState<LocateMode>('address');

  // ── Address mode ────────────────────────────────────────────────────────────
  const [locateQuery, setLocateQuery] = useState('');
  const [locateFeedback, setLocateFeedback] = useState<LocateFeedback>({ kind: 'idle', message: null });

  // ── Product mode ─────────────────────────────────────────────────────────────
  const [productInput, setProductInput] = useState('');
  const [debouncedProductInput, setDebouncedProductInput] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [productFeedback, setProductFeedback] = useState<LocateFeedback>({ kind: 'idle', message: null });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeFloorId = useActiveFloorId();
  const viewMode = useWarehouseViewMode();
  const setSelectedCellId = useSetWarehouseSelectedCellId();
  const setHighlightedCellIds = useSetWarehouseHighlightedCells();
  const clearHighlightedCellIds = useClearWarehouseHighlightedCells();
  const publishedCellsQuery = usePublishedCells(activeFloorId);
  const publishedCells = publishedCellsQuery.data ?? [];

  // Debounce product input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedProductInput(productInput), 300);
    return () => clearTimeout(timer);
  }, [productInput]);

  const productSearchEnabled = debouncedProductInput.trim().length >= 2 && !selectedProduct;
  const productsQuery = useQuery({
    ...productsSearchQueryOptions(debouncedProductInput),
    enabled: productSearchEnabled
  });

  const cellsByProductQuery = useQuery(
    floorCellsByProductQueryOptions(activeFloorId, selectedProduct?.id ?? null)
  );

  // When cells-by-product result arrives, highlight them
  useEffect(() => {
    if (!selectedProduct || cellsByProductQuery.isPending) return;
    if (cellsByProductQuery.isError) {
      setProductFeedback({ kind: 'error', message: 'Failed to locate product cells.' });
      return;
    }
    const cellIds = cellsByProductQuery.data ?? [];
    if (cellIds.length === 0) {
      setProductFeedback({ kind: 'not-found', message: 'Not found on this floor.' });
      clearHighlightedCellIds();
    } else {
      setHighlightedCellIds(cellIds);
      setProductFeedback({
        kind: 'found',
        message: `Found in ${cellIds.length} cell${cellIds.length === 1 ? '' : 's'}.`
      });
    }
  }, [cellsByProductQuery.data, cellsByProductQuery.isPending, cellsByProductQuery.isError, selectedProduct]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isDropdownOpen]);

  const handleSwitchMode = (next: LocateMode) => {
    setMode(next);
    clearHighlightedCellIds();
    setLocateQuery('');
    setLocateFeedback({ kind: 'idle', message: null });
    setProductInput('');
    setSelectedProduct(null);
    setProductFeedback({ kind: 'idle', message: null });
    setIsDropdownOpen(false);
  };

  // ── Address mode ─────────────────────────────────────────────────────────────
  const locateDataGapReason = useMemo(() => {
    if (!activeFloorId) return 'Select a floor to use locate.';
    if (publishedCellsQuery.isError) return 'Locate is unavailable: failed to load published cells.';
    if (publishedCells.length === 0) return 'Locate is unavailable: no published cells found for this floor.';

    const byNormalizedAddress = new Map<string, string>();
    for (const cell of publishedCells) {
      const rawAddress = cell.address?.raw;
      if (typeof rawAddress !== 'string' || rawAddress.trim() === '') {
        return 'Locate is unavailable: some published cells are missing stable address.raw.';
      }
      const normalizedAddress = normalizeLocateToken(rawAddress);
      if (!normalizedAddress) {
        return 'Locate is unavailable: some published cells have invalid address.raw.';
      }
      const existingCellId = byNormalizedAddress.get(normalizedAddress);
      if (existingCellId && existingCellId !== cell.id) {
        return 'Locate is unavailable: duplicate normalized address.raw detected.';
      }
      byNormalizedAddress.set(normalizedAddress, cell.id);
    }
    return null;
  }, [activeFloorId, publishedCellsQuery.isError, publishedCells]);

  const locateLookupByAddress = useMemo(() => {
    if (locateDataGapReason) return new Map<string, string>();
    const lookup = new Map<string, string>();
    for (const cell of publishedCells) {
      lookup.set(normalizeLocateToken(cell.address.raw), cell.id);
    }
    return lookup;
  }, [locateDataGapReason, publishedCells]);

  useEffect(() => {
    if (publishedCellsQuery.isLoading) return;
    setLocateFeedback((prev) => {
      if (locateDataGapReason) {
        if (prev.kind === 'error' && prev.message === locateDataGapReason) return prev;
        return { kind: 'error', message: locateDataGapReason };
      }
      if (prev.kind === 'error') return { kind: 'idle', message: null };
      return prev;
    });
  }, [locateDataGapReason, publishedCellsQuery.isLoading]);

  const handleLocateSubmit = () => {
    if (locateDataGapReason) {
      setLocateFeedback({ kind: 'error', message: locateDataGapReason });
      return;
    }
    const normalizedQuery = normalizeLocateToken(locateQuery);
    if (!normalizedQuery) {
      setLocateFeedback({ kind: 'invalid', message: 'Enter a cell address.' });
      return;
    }
    const matchedCellId = locateLookupByAddress.get(normalizedQuery);
    if (!matchedCellId) {
      setLocateFeedback({ kind: 'not-found', message: `Cell "${locateQuery.trim()}" not found.` });
      return;
    }
    const matchedCell = publishedCells.find((cell) => cell.id === matchedCellId);
    setSelectedCellId(matchedCellId);
    setHighlightedCellIds([matchedCellId]);
    if (viewMode === 'storage' && matchedCell) {
      warehouseStorageFocusActions.selectCell({
        cellId: matchedCell.id,
        rackId: matchedCell.rackId,
        level: matchedCell.address.parts.level
      });
    }
    setLocateFeedback({ kind: 'found', message: `Located ${locateQuery.trim()}.` });
  };

  // ── Product mode handlers ─────────────────────────────────────────────────
  const handleProductInputChange = (value: string) => {
    setProductInput(value);
    setSelectedProduct(null);
    setProductFeedback({ kind: 'idle', message: null });
    clearHighlightedCellIds();
    setIsDropdownOpen(value.trim().length >= 2);
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setProductInput(product.sku ? `${product.sku} — ${product.name}` : product.name);
    setIsDropdownOpen(false);
    setProductFeedback({ kind: 'idle', message: null });
  };

  const handleProductClear = () => {
    setProductInput('');
    setSelectedProduct(null);
    setProductFeedback({ kind: 'idle', message: null });
    clearHighlightedCellIds();
  };

  // ── Feedback colors ──────────────────────────────────────────────────────
  const feedbackColor = (kind: LocateFeedback['kind']) =>
    kind === 'error'
      ? 'text-red-600'
      : kind === 'not-found' || kind === 'invalid'
        ? 'text-amber-600'
        : kind === 'found'
          ? 'text-emerald-600'
          : 'text-slate-500';

  const products = productsQuery.data ?? [];
  const showDropdown = isDropdownOpen && products.length > 0;

  return (
    <div className="flex h-8 items-center gap-2">
      {/* Mode tabs */}
      <div
        className="flex rounded-full p-0.5 text-xs"
        style={{ background: 'rgba(0,0,0,0.07)' }}
      >
        {(['address', 'product'] as LocateMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => handleSwitchMode(m)}
            className="rounded-full px-2.5 py-0.5 font-medium capitalize transition-colors"
            style={
              mode === m
                ? { background: 'white', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }
                : { color: 'var(--text-muted)' }
            }
          >
            {m === 'address' ? 'Address' : 'Item'}
          </button>
        ))}
      </div>

      {/* Address mode */}
      {mode === 'address' && (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => { e.preventDefault(); handleLocateSubmit(); }}
        >
          <input
            aria-label="Locate cell address"
            placeholder="Cell address…"
            value={locateQuery}
            onChange={(e) => {
              setLocateQuery(e.target.value);
              setLocateFeedback({ kind: 'idle', message: null });
            }}
            disabled={publishedCellsQuery.isLoading}
            className="h-6 w-48 rounded-full border-0 bg-transparent px-3 text-sm text-slate-700 outline-none placeholder:text-slate-500 focus:ring-0 disabled:cursor-not-allowed disabled:text-slate-400"
          />
          <button
            type="submit"
            disabled={publishedCellsQuery.isLoading}
            className="flex h-6 items-center rounded-full border px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-white/40 disabled:cursor-not-allowed disabled:text-slate-400"
            style={{
              borderColor: 'rgba(37, 99, 235, 0.45)',
              background: 'color-mix(in srgb, var(--surface-primary) 55%, transparent)'
            }}
          >
            Locate
          </button>
          {locateFeedback.message && (
            <span className={`text-xs ${feedbackColor(locateFeedback.kind)}`}>
              {locateFeedback.message}
            </span>
          )}
        </form>
      )}

      {/* Product mode */}
      {mode === 'product' && (
        <div ref={dropdownRef} className="relative flex items-center gap-1.5">
          <div className="relative">
            <input
              aria-label="Search by product name or SKU"
              placeholder="Name or SKU…"
              value={productInput}
              onChange={(e) => handleProductInputChange(e.target.value)}
              onFocus={() => {
                if (productInput.trim().length >= 2 && products.length > 0 && !selectedProduct) {
                  setIsDropdownOpen(true);
                }
              }}
              className="h-6 w-52 rounded-full border-0 bg-transparent px-3 text-sm text-slate-700 outline-none placeholder:text-slate-500 focus:ring-0"
            />
            {productInput && (
              <button
                type="button"
                onClick={handleProductClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Clear"
              >
                ×
              </button>
            )}

            {/* Dropdown */}
            {showDropdown && (
              <div
                className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-xl shadow-lg"
                style={{
                  background: 'var(--surface-strong)',
                  border: '1px solid var(--border-muted)'
                }}
              >
                {products.slice(0, 8).map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleProductSelect(product); }}
                    className="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-slate-100"
                  >
                    <span className="text-sm font-medium leading-tight text-slate-800 line-clamp-1">
                      {product.name}
                    </span>
                    {product.sku && (
                      <span className="font-mono text-[11px] text-slate-500">{product.sku}</span>
                    )}
                  </button>
                ))}
                {productsQuery.isLoading && (
                  <div className="px-3 py-2 text-xs text-slate-400">Searching…</div>
                )}
              </div>
            )}
          </div>

          {/* Feedback */}
          {productFeedback.message && (
            <span className={`text-xs ${feedbackColor(productFeedback.kind)}`}>
              {productFeedback.kind === 'found' && cellsByProductQuery.isFetching
                ? 'Searching…'
                : productFeedback.message}
            </span>
          )}
          {selectedProduct && cellsByProductQuery.isFetching && !productFeedback.message && (
            <span className="text-xs text-slate-400">Searching…</span>
          )}
        </div>
      )}
    </div>
  );
}

export function WarehouseTopBar() {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const toggle = useToggleDrawer();
  const isCollapsed = useIsDrawerCollapsed();
  const pathname = typeof window === 'undefined' ? '' : window.location.pathname;
  const isWarehouseViewRoute = pathname.includes(routes.warehouseView);

  const activeFloorId = useActiveFloorId();
  const viewMode = useWarehouseViewMode();
  const shouldShowLocateInline =
    isWarehouseViewRoute ||
    (pathname.startsWith(routes.warehouse) && viewMode !== 'layout');
  const layoutDraft = useWarehouseLayoutDraft();
  const isDraftDirty = useIsWarehouseDraftDirty();
  const persistenceStatus = useWarehouseDraftStatus();
  const workspaceQuery = useFloorWorkspace(activeFloorId);
  const latestPublished = workspaceQuery.data?.latestPublished ?? null;
  const persistedDraftValidation = useLayoutValidation(layoutDraft?.layoutVersionId ?? null).cachedResult;

  const hasDraftLayout = layoutDraft?.state === 'draft';

  const issueSummary = useMemo(() => {
    // Published state is already communicated by the breadcrumb badge and
    // the PublishedBanner below the TopBar — no need to repeat it here.
    if (!layoutDraft && latestPublished) return null;
    if (layoutDraft?.state === 'published') return null;
    if (isDraftDirty) return 'Draft changed';
    if (!persistedDraftValidation) return null;
    return persistedDraftValidation.isValid
      ? 'Valid'
      : `${persistedDraftValidation.issues.length} issue(s)`;
  }, [isDraftDirty, latestPublished, layoutDraft, persistedDraftValidation]);

  // Clear any explicit action feedback the moment the draft becomes dirty so that
  // ambient state labels (e.g. "Draft changed") are never hidden by a stale message.
  useEffect(() => {
    if (isDraftDirty) setStatusMessage(null);
  }, [isDraftDirty]);

  // Explicit action feedback (statusMessage) takes priority over computed ambient
  // state (issueSummary) so that targeted messages like a specific validation error
  // are not overridden by the generic issue count derived from the cached result.
  const inlineStatusMessage = statusMessage ?? issueSummary;

  const workspaceStateLabel = !hasDraftLayout
    ? 'Published'
    : viewMode !== 'layout'
      ? 'Read-only'
      : persistenceStatus === 'dirty'
        ? 'Unsaved'
        : persistenceStatus === 'saving'
          ? 'Saving...'
          : persistenceStatus === 'conflict'
            ? 'Conflict'
            : persistenceStatus === 'error'
              ? 'Save failed'
              : 'Saved';

  const isCurrentModeLocked = viewMode !== 'layout' || !hasDraftLayout;
  const workspaceStateStyle = isCurrentModeLocked
    ? { background: 'rgba(37,99,235,0.12)', color: '#1d4ed8' }
    : persistenceStatus === 'dirty'
      ? { background: 'rgba(183,121,31,0.12)', color: 'var(--warning)' }
      : persistenceStatus === 'saving'
        ? { background: 'rgba(37,99,235,0.12)', color: '#1d4ed8' }
        : persistenceStatus === 'conflict' || persistenceStatus === 'error'
          ? { background: 'rgba(220,38,38,0.12)', color: '#b91c1c' }
          : { background: 'rgba(20,125,100,0.1)', color: 'var(--success)' };

  const workspaceTooltip = !hasDraftLayout
    ? 'Structure locked · switch to Layout and create a draft to edit'
    : viewMode !== 'layout'
      ? 'Read-only in View/Storage · switch to Layout to edit structure'
      : null;

  return (
    <div className="relative shrink-0">
      <TopBarShell
        className="[&>div]:h-14 [&>div]:grid-cols-[auto_minmax(0,1fr)_auto] [&>div]:gap-1 [&>div]:px-2 md:[&>div]:grid-cols-[minmax(0,1.1fr)_auto_minmax(0,1fr)] md:[&>div]:gap-4 md:[&>div]:px-3"
        style={{
          background: 'var(--surface-primary)'
        }}
        left={
          <div className="flex h-full min-w-0 items-center gap-3">
            <div
              className="flex h-full shrink-0 items-center gap-2 pr-3"
            >
              <IconButton
                icon={<Menu className="h-4 w-4" />}
                onClick={toggle}
                title={isCollapsed ? 'Open navigation' : 'Close navigation'}
                className="h-8 w-8 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              />
              <span
                className="flex h-7 w-7 items-center justify-center rounded-md text-[13px] font-black tracking-widest text-white"
                style={{ background: 'var(--accent)' }}
                aria-hidden="true"
              >
                W
              </span>
              <span className="hidden text-sm font-semibold text-slate-800 sm:inline">Warehouse Ops</span>
            </div>

            <div className="hidden min-w-0 border-l pl-3 md:block" style={{ borderColor: 'var(--border-muted)' }}>
              <WorkspaceNav
                onContextSwitched={() => setStatusMessage(null)}
                statusBadge={
                  <WorkspaceStatus
                    variant="badge"
                    label={workspaceStateLabel}
                    isCurrentModeLocked={isCurrentModeLocked}
                    style={workspaceStateStyle}
                    tooltip={workspaceTooltip}
                  />
                }
              />
            </div>
          </div>
        }
        center={<ViewModeSwitcher />}
        right={
          <div className="flex h-full min-w-0 items-center justify-end gap-3">
            <div
              className="hidden min-w-0 items-center gap-2 border-l pl-3 md:flex"
              style={{ borderColor: 'var(--border-muted)' }}
            >
              <WorkspaceStatus variant="inline" message={inlineStatusMessage} />
              <WorkspaceActions onStatusMessageChange={setStatusMessage} />
            </div>

            <div className="border-l" style={{ borderColor: 'var(--border-muted)' }}>
              <AccountControls />
            </div>
          </div>
        }
      />
      {shouldShowLocateInline && (
        <div className="pointer-events-none absolute left-1/2 top-full z-20 -translate-x-1/2 pt-2">
          <div
            className="pointer-events-auto rounded-full border px-3 py-1.5 shadow-[0_2px_10px_rgba(15,23,42,0.08)] backdrop-blur-sm"
            style={{
              borderColor: 'rgba(37, 99, 235, 0.85)',
              background: 'color-mix(in srgb, #d1d5db 72%, transparent)'
            }}
          >
            <WarehouseViewLocateInline />
          </div>
        </div>
      )}
    </div>
  );
}
