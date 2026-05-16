import { CornerDownLeft, Menu, Search, X } from 'lucide-react';
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
import { useT } from '@/shared/i18n';
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
  const t = useT();
  const [mode, setMode] = useState<LocateMode>('address');

  // ── Address mode ────────────────────────────────────────────────────────────
  const [locateQuery, setLocateQuery] = useState('');
  const [locateFeedback, setLocateFeedback] = useState<LocateFeedback>({ kind: 'idle', message: null });

  // ── Product mode ─────────────────────────────────────────────────────────────
  const [productInput, setProductInput] = useState('');
  const [debouncedProductInput, setDebouncedProductInput] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
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
      setProductFeedback({ kind: 'error', message: t('warehouse.locate.failedProductCells') });
      return;
    }
    const cellIds = cellsByProductQuery.data ?? [];
    if (cellIds.length === 0) {
      setProductFeedback({ kind: 'not-found', message: t('warehouse.locate.productNotFoundFloor') });
      clearHighlightedCellIds();
    } else {
      setHighlightedCellIds(cellIds);
      setProductFeedback({
        kind: 'found',
        message: t('warehouse.locate.foundCells', { count: cellIds.length, suffix: cellIds.length === 1 ? '' : 's' })
      });
    }
  }, [cellsByProductQuery.data, cellsByProductQuery.isPending, cellsByProductQuery.isError, clearHighlightedCellIds, selectedProduct, setHighlightedCellIds, t]);

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
    if (!activeFloorId) return t('warehouse.locate.selectFloor');
    if (publishedCellsQuery.isError) return t('warehouse.locate.failedToLoad');
    if (publishedCells.length === 0) return t('warehouse.locate.noCells');

    const byNormalizedAddress = new Map<string, string>();
    for (const cell of publishedCells) {
      const rawAddress = cell.address?.raw;
      if (typeof rawAddress !== 'string' || rawAddress.trim() === '') {
        return t('warehouse.locate.missingAddress');
      }
      const normalizedAddress = normalizeLocateToken(rawAddress);
      if (!normalizedAddress) {
        return t('warehouse.locate.invalidAddress');
      }
      const existingCellId = byNormalizedAddress.get(normalizedAddress);
      if (existingCellId && existingCellId !== cell.id) {
        return t('warehouse.locate.duplicateAddress');
      }
      byNormalizedAddress.set(normalizedAddress, cell.id);
    }
    return null;
  }, [activeFloorId, publishedCellsQuery.isError, publishedCells, t]);

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

  const handleLocateSubmit = (queryOverride?: string) => {
    if (locateDataGapReason) {
      setLocateFeedback({ kind: 'error', message: locateDataGapReason });
      return;
    }
    const queryText = queryOverride ?? locateQuery;
    const normalizedQuery = normalizeLocateToken(queryText);
    if (!normalizedQuery) {
      setLocateFeedback({ kind: 'invalid', message: t('warehouse.locate.enterAddress') });
      return;
    }
    const matchedCellId = locateLookupByAddress.get(normalizedQuery);
    if (!matchedCellId) {
      setLocateFeedback({ kind: 'not-found', message: t('warehouse.locate.notFound', { query: queryText.trim() }) });
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
    setLocateFeedback({ kind: 'found', message: t('warehouse.locate.found', { query: queryText.trim() }) });
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
    setMode('product');
    setSelectedProduct(product);
    setProductInput(product.sku ? `${product.sku} — ${product.name}` : product.name);
    setIsDropdownOpen(false);
    setProductFeedback({ kind: 'idle', message: null });
  };

  const products = productsQuery.data ?? [];
  const searchInputValue = mode === 'product' ? productInput : locateQuery;
  const primaryFeedback = productFeedback.message ? productFeedback : locateFeedback;
  const isLocatingSelectedProduct = Boolean(selectedProduct) && cellsByProductQuery.isFetching;
  const isExpanded =
    isFocused ||
    searchInputValue.trim().length > 0 ||
    Boolean(primaryFeedback.message) ||
    isLocatingSelectedProduct ||
    isDropdownOpen;

  const handleUnifiedInputChange = (value: string) => {
    setMode('address');
    setLocateQuery(value);
    setLocateFeedback({ kind: 'idle', message: null });
    handleProductInputChange(value);
  };

  const handleUnifiedClear = () => {
    handleSwitchMode('address');
  };

  const handleUnifiedSubmit = () => {
    const value = searchInputValue.trim();
    if (!value) {
      setLocateFeedback({ kind: 'invalid', message: t('warehouse.locate.enterAddressSkuItem') });
      return;
    }

    const matchedCellId = locateLookupByAddress.get(normalizeLocateToken(value));
    if (matchedCellId) {
      setMode('address');
      setLocateQuery(value);
      handleLocateSubmit(value);
      return;
    }

    if (products.length > 0) {
      handleProductSelect(products[0]);
      return;
    }

    if (productsQuery.isLoading) {
      setProductFeedback({ kind: 'idle', message: t('warehouse.locate.searching') });
      return;
    }

    setLocateFeedback({ kind: 'not-found', message: t('warehouse.locate.noAddressOrItem', { value }) });
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

  const showDropdown = isDropdownOpen && (products.length > 0 || productsQuery.isLoading);

  return (
    <div
      ref={dropdownRef}
      className={`relative flex h-8 items-center gap-2 transition-[width] duration-200 ease-out ${
        isExpanded ? 'w-[min(32rem,calc(100vw-3rem))]' : 'w-36'
      }`}
    >
      <form
        className="relative flex h-8 min-w-0 flex-1 items-center"
        onSubmit={(event) => {
          event.preventDefault();
          handleUnifiedSubmit();
        }}
      >
        <Search className="pointer-events-none absolute start-2.5 h-4 w-4 text-slate-500" />
        <input
          aria-label={t('warehouse.locate.searchLabel')}
          autoComplete="off"
          placeholder={isExpanded ? t('warehouse.locate.searchExpandedPlaceholder') : t('warehouse.locate.searchPlaceholder')}
          value={searchInputValue}
          onChange={(event) => handleUnifiedInputChange(event.target.value)}
          onFocus={() => {
            setIsFocused(true);
            if (searchInputValue.trim().length >= 2) setIsDropdownOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            handleUnifiedSubmit();
          }}
          onBlur={() => setIsFocused(false)}
          disabled={publishedCellsQuery.isLoading}
          className="h-8 min-w-0 flex-1 rounded-full border-0 bg-transparent pe-9 ps-8 text-sm text-slate-700 outline-none placeholder:text-slate-500 focus:ring-0 disabled:cursor-not-allowed disabled:text-slate-400"
        />
        {searchInputValue.trim() ? (
          <button
            type="button"
            onClick={handleUnifiedClear}
            className="absolute end-2 flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700"
            aria-label={t('warehouse.locate.clearSearch')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="submit"
            className="absolute end-2 hidden h-5 w-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700 sm:flex"
            aria-label={t('warehouse.locate.runSearch')}
          >
            <CornerDownLeft className="h-3.5 w-3.5" />
          </button>
        )}
        </form>

      {showDropdown && (
        <div
          className="absolute start-0 top-full z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-lg py-1 shadow-[0_12px_28px_rgba(15,23,42,0.16)]"
          style={{
            background: 'var(--surface-strong)',
            border: '1px solid var(--border-muted)'
          }}
        >
          {products.length > 0 && (
            <div className="py-1">
              <div className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase text-slate-400">
                {t('warehouse.locate.items')}
              </div>
              {products.slice(0, 8).map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleProductSelect(product);
                  }}
                  className="flex w-full flex-col gap-0.5 px-3 py-2 text-start transition-colors hover:bg-slate-100"
                >
                  <span className="text-sm font-medium leading-tight text-slate-800 line-clamp-1">
                    {product.name}
                  </span>
                  {product.sku && (
                    <span className="font-mono text-[11px] text-slate-500" dir="ltr">{product.sku}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {productsQuery.isLoading && (
            <div className="px-3 py-2 text-xs text-slate-400">{t('warehouse.locate.searching')}</div>
          )}
        </div>
      )}
      {(primaryFeedback.message || isLocatingSelectedProduct) && isExpanded && (
        <span className={`max-w-44 truncate text-xs ${feedbackColor(primaryFeedback.kind)}`}>
          {isLocatingSelectedProduct ? t('warehouse.locate.searching') : primaryFeedback.message}
        </span>
      )}
    </div>
  );
}

export function WarehouseTopBar() {
  const t = useT();
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
    if (isDraftDirty) return t('warehouse.status.draftChanged');
    if (!persistedDraftValidation) return null;
    return persistedDraftValidation.isValid
      ? t('warehouse.status.valid')
      : t('warehouse.status.issueCount', { count: persistedDraftValidation.issues.length });
  }, [isDraftDirty, latestPublished, layoutDraft, persistedDraftValidation, t]);

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
    ? t('warehouse.status.published')
    : viewMode !== 'layout'
      ? t('warehouse.status.readOnly')
      : persistenceStatus === 'dirty'
        ? t('warehouse.status.unsaved')
        : persistenceStatus === 'saving'
          ? t('warehouse.status.saving')
          : persistenceStatus === 'conflict'
            ? t('warehouse.status.conflict')
            : persistenceStatus === 'error'
              ? t('warehouse.status.saveFailed')
              : t('warehouse.status.saved');

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
    ? t('warehouse.tooltip.publishedLocked')
    : viewMode !== 'layout'
      ? t('warehouse.tooltip.readOnly')
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
              className="flex h-full shrink-0 items-center gap-2 pe-3"
            >
              <IconButton
                icon={<Menu className="h-4 w-4" />}
                onClick={toggle}
                title={isCollapsed ? t('app.navigation.open') : t('app.navigation.close')}
                className="h-8 w-8 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              />
              <span
                className="flex h-7 w-7 items-center justify-center rounded-md text-[13px] font-black tracking-widest text-white"
                style={{ background: 'var(--accent)' }}
                aria-hidden="true"
              >
                W
              </span>
              <span className="hidden text-sm font-semibold text-slate-800 sm:inline">{t('app.brand.name')}</span>
            </div>

            <div className="hidden min-w-0 border-s ps-3 md:block" style={{ borderColor: 'var(--border-muted)' }}>
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
              className="hidden min-w-0 items-center gap-2 border-s ps-3 md:flex"
              style={{ borderColor: 'var(--border-muted)' }}
            >
              <WorkspaceStatus variant="inline" message={inlineStatusMessage} />
              <WorkspaceActions onStatusMessageChange={setStatusMessage} />
            </div>

            <div className="border-s" style={{ borderColor: 'var(--border-muted)' }}>
              <AccountControls />
            </div>
          </div>
        }
      />
      {shouldShowLocateInline && (
        <div className="pointer-events-none absolute left-1/2 top-full z-20 -translate-x-1/2 pt-2">
          <div
            className="pointer-events-auto rounded-full border px-2 py-1 opacity-85 shadow-[0_2px_10px_rgba(15,23,42,0.08)] backdrop-blur-md transition-opacity hover:opacity-100 focus-within:opacity-100"
            style={{
              borderColor: 'rgba(100, 116, 139, 0.38)',
              background: 'color-mix(in srgb, var(--surface-primary) 68%, transparent)'
            }}
          >
            <WarehouseViewLocateInline />
          </div>
        </div>
      )}
    </div>
  );
}
