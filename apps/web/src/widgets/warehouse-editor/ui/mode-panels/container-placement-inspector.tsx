import { useDeferredValue, useState } from 'react';
import type { ContainerStorageSnapshotRow, FloorWorkspace } from '@wos/domain';
import {
  AlertCircle,
  ArrowLeft,
  Box,
  Loader2,
  MoveRight,
  PackageOpen,
  Search,
  X
} from 'lucide-react';
import {
  useCancelPlacementInteraction,
  useEditorSelection,
  usePlacementInteraction,
  useSetSelectedCellId,
  useSetSelectedContainerId,
  useStartPlacementMove
} from '@/entities/layout-version/model/editor-selectors';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { useContainerStorage } from '@/entities/container/api/use-container-storage';
import { useProduct } from '@/entities/product/api/use-product';
import { useProductsSearch } from '@/entities/product/api/use-products-search';
import { getProductImageUrl, getProductLabel, getProductMeta } from '@/entities/product/lib/display';
import { useAddInventoryItem } from '@/features/inventory-add/model/use-add-inventory-item';
import { useMoveContainer } from '@/features/placement-actions/model/use-move-container';
import { useRemoveContainer } from '@/features/placement-actions/model/use-remove-container';
import { useAddInventoryToContainer } from '@/features/container-inventory/model/use-add-inventory-to-container';

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  quarantined: { label: 'Quarantined', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  closed: { label: 'Closed', className: 'bg-slate-100 text-slate-500 border-slate-200' },
  lost: { label: 'Lost', className: 'bg-red-50 text-red-600 border-red-200' },
  damaged: { label: 'Damaged', className: 'bg-orange-50 text-orange-700 border-orange-200' }
};

function StatusBadge({ status }: { status: string }) {
  const style =
    STATUS_STYLES[status] ?? {
      label: status,
      className: 'bg-slate-100 text-slate-500 border-slate-200'
    };

  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${style.className}`}>
      {style.label}
    </span>
  );
}

type InventoryRow = Pick<ContainerStorageSnapshotRow, 'product'> & {
  itemRef: string;
  quantity: number;
  uom: string;
};

function extractInventory(rows: ContainerStorageSnapshotRow[]): InventoryRow[] {
  return rows
    .filter((row) => row.itemRef !== null && row.quantity !== null && row.uom !== null)
    .map((row) => ({
      itemRef: row.itemRef!,
      product: row.product,
      quantity: row.quantity!,
      uom: row.uom!
    }));
}

function formatQuantityInput(value: string) {
  if (value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function canReceiveInventory(status: string | null | undefined) {
  return status === 'active';
}

function formatMutationError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function ContainerPlacementInspector({ workspace }: { workspace: FloorWorkspace | null }) {
  const selection = useEditorSelection();
  const placementInteraction = usePlacementInteraction();
  const setSelectedContainerId = useSetSelectedContainerId();
  const setSelectedCellId = useSetSelectedCellId();
  const startPlacementMove = useStartPlacementMove();
  const cancelPlacementInteraction = useCancelPlacementInteraction();
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
  const [isAddInventoryOpen, setIsAddInventoryOpen] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [quantityInput, setQuantityInput] = useState('1');
  const [uomInput, setUomInput] = useState('pcs');

  const containerId = selection.type === 'container' ? selection.containerId : null;
  const sourceCellId = selection.type === 'container' ? selection.sourceCellId ?? null : null;
  const isMoveMode =
    placementInteraction.type === 'move-container' &&
    placementInteraction.containerId === containerId &&
    placementInteraction.fromCellId === sourceCellId;
  const targetCellId = isMoveMode ? placementInteraction.targetCellId : null;

  const deferredProductSearch = useDeferredValue(productSearch);
  const { data: publishedCells = [] } = usePublishedCells(workspace?.floorId ?? null);
  const sourceCell = publishedCells.find((cell) => cell.id === sourceCellId) ?? null;
  const targetCell = publishedCells.find((cell) => cell.id === targetCellId) ?? null;
  const { data: rows, isPending, isError } = useContainerStorage(containerId);
  const {
    data: productResults = [],
    isPending: isProductsPending,
    isError: isProductsError
  } = useProductsSearch(isAddInventoryOpen ? deferredProductSearch : null);
  const { data: selectedProduct } = useProduct(selectedProductId);

  const identity = rows && rows.length > 0 ? rows[0] : null;
  const inventory = rows ? extractInventory(rows) : [];
  const quantityValue = formatQuantityInput(quantityInput);
  const activeProduct =
    selectedProduct ??
    productResults.find((product) => product.id === selectedProductId) ??
    null;
  const removeContainer = useRemoveContainer({
    floorId: workspace?.floorId ?? null,
    sourceCellId,
    containerId
  });
  const addInventoryToContainer = useAddInventoryToContainer({
    floorId: workspace?.floorId ?? null,
    sourceCellId,
    containerId
  });
  const moveContainer = useMoveContainer({
    floorId: workspace?.floorId ?? null,
    sourceCellId,
    targetCellId,
    containerId
  });
  const addInventoryItem = useAddInventoryItem({
    floorId: workspace?.floorId ?? null,
    sourceCellId,
    containerId
  });

  const targetValidationMessage =
    !isMoveMode
      ? null
      : !targetCellId
        ? 'Click a destination cell on the canvas.'
        : targetCellId === sourceCellId
          ? 'Target cell must differ from the current source cell.'
          : !targetCell
            ? 'Selected target cell is not available in the published structure.'
            : null;

  const handleRemove = async () => {
    if (!containerId || !sourceCellId) {
      return;
    }

    setRemoveError(null);

    try {
      await removeContainer.mutateAsync({
        containerId,
        fromCellId: sourceCellId
      });
      setSelectedCellId(sourceCellId);
    } catch (mutationError) {
      setRemoveError(
        mutationError instanceof Error
          ? mutationError.message
          : 'Could not remove the container from its cell.'
      );
    }
  };

  const handleStartMove = () => {
    if (!containerId || !sourceCellId) {
      return;
    }

    setMoveError(null);
    setIsRemoveConfirmOpen(false);
    setIsAddInventoryOpen(false);
    startPlacementMove(containerId, sourceCellId);
  };

  const handleCancelMove = () => {
    cancelPlacementInteraction();
    setMoveError(null);
  };

  const handleConfirmMove = async () => {
    if (!containerId || !sourceCellId || !targetCellId || targetValidationMessage) {
      return;
    }

    setMoveError(null);

    try {
      await moveContainer.mutateAsync({
        containerId,
        fromCellId: sourceCellId,
        toCellId: targetCellId
      });
      setSelectedCellId(targetCellId);
    } catch (mutationError) {
      setMoveError(
        mutationError instanceof Error ? mutationError.message : 'Could not move the container.'
      );
    }
  };

  const handleAddInventory = async () => {
    if (!containerId || !activeProduct || quantityValue === null || uomInput.trim().length === 0) {
      return;
    }

    setInventoryError(null);

    try {
      await addInventoryItem.mutateAsync({
        containerId,
        productId: activeProduct.id,
        quantity: quantityValue,
        uom: uomInput.trim()
      });
      setIsAddInventoryOpen(false);
      setProductSearch('');
      setSelectedProductId(null);
      setQuantityInput('1');
      setUomInput('pcs');
    } catch (mutationError) {
      setInventoryError(
        mutationError instanceof Error ? mutationError.message : 'Could not add inventory.'
      );
    }
  };

  return (
    <aside className="flex h-full w-full flex-col" style={{ background: 'var(--surface-primary)' }}>
      <div className="border-b border-[var(--border-muted)] px-5 py-4">
        <button
          type="button"
          onClick={() => {
            cancelPlacementInteraction();
            setSelectedContainerId(null);
          }}
          className="mb-3 flex items-center gap-1 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </button>

        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          Container
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Box className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
          <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
            {identity?.externalCode ?? containerId ?? 'вЂ”'}
          </span>
        </div>
        {identity && (
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[11px] text-[var(--text-muted)]">{identity.containerType}</span>
            <StatusBadge status={identity.containerStatus} />
          </div>
        )}
        {sourceCellId && (
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">
            Placed in {sourceCell?.address.raw ?? sourceCellId}
          </p>
        )}
        {sourceCellId && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              style={{ borderColor: 'var(--border-muted)' }}
              onClick={handleToggleAddInventory}
              disabled={
                isMoveMode ||
                removeContainer.isPending ||
                moveContainer.isPending ||
                addInventoryToContainer.isPending ||
                !isInventoryReceivable
              }
            >
              {addInventoryToContainer.isPending
                ? 'Adding inventory...'
                : isAddInventoryOpen
                  ? 'Cancel inventory'
                  : 'Add inventory'}
            </button>
            <button
              type="button"
              className="rounded-md px-3 py-2 text-xs font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
              onClick={handleStartMove}
              disabled={removeContainer.isPending || moveContainer.isPending || addInventoryItem.isPending}
            >
              {isMoveMode ? 'Move target active' : 'Move container'}
            </button>
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-xs font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-primary)' }}
              onClick={() => {
                setInventoryError(null);
                setIsRemoveConfirmOpen(false);
                setIsAddInventoryOpen((current) => !current);
              }}
              disabled={isMoveMode || removeContainer.isPending || moveContainer.isPending}
            >
              Add inventory
            </button>
            <button
              type="button"
              className="rounded-md px-3 py-2 text-xs font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: 'var(--danger)' }}
              onClick={() => {
                setRemoveError(null);
                setIsAddInventoryOpen(false);
                setIsRemoveConfirmOpen((current) => !current);
              }}
              disabled={isMoveMode || removeContainer.isPending || moveContainer.isPending || addInventoryToContainer.isPending}
            >
              {removeContainer.isPending ? 'Removing...' : 'Remove from cell'}
            </button>
          </div>
        )}
        {identity && !isInventoryReceivable && (
          <p className="mt-2 text-[11px] text-amber-600">
            Only active containers can receive inventory.
          </p>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {isMoveMode && sourceCellId && (
          <div
            className="rounded-lg p-3"
            style={{ background: 'var(--surface-subtle)', border: '1px solid var(--accent)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--accent)]">
                  Move target selection active
                </p>
                <p className="mt-1 text-xs text-[var(--text-primary)]">
                  Select an explicit destination cell on the canvas, then confirm the move.
                </p>
              </div>
              <button
                type="button"
                className="rounded-md border p-1.5 text-[var(--text-muted)]"
                style={{ borderColor: 'var(--border-muted)' }}
                onClick={handleCancelMove}
                disabled={moveContainer.isPending}
                title="Cancel move"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-3 rounded-md border border-[var(--border-muted)] bg-[var(--surface-primary)] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Target cell</p>
              <p className="mt-1 font-mono text-sm text-[var(--text-primary)]">
                {targetCell?.address.raw ?? targetCellId ?? 'No target selected'}
              </p>
              {targetValidationMessage && (
                <p className="mt-1 text-xs text-amber-600">{targetValidationMessage}</p>
              )}
              {moveError && <p className="mt-1 text-xs text-red-500">{moveError}</p>}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-xs font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: 'var(--accent)' }}
                onClick={() => void handleConfirmMove()}
                disabled={moveContainer.isPending || Boolean(targetValidationMessage)}
              >
                <MoveRight className="h-3.5 w-3.5" />
                {moveContainer.isPending ? 'Moving...' : 'Confirm move'}
              </button>
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-xs font-medium text-[var(--text-muted)]"
                style={{ borderColor: 'var(--border-muted)' }}
                onClick={handleCancelMove}
                disabled={moveContainer.isPending}
              >
                Cancel move
              </button>
            </div>
          </div>
        )}

        {isAddInventoryOpen && containerId && (
          <div
            className="rounded-lg p-3"
            style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-muted)' }}
          >
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Add inventory
            </p>

            <label className="mt-3 block text-xs text-[var(--text-primary)]">
              Search products
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  value={productSearch}
                  onChange={(event) => {
                    setProductSearch(event.target.value);
                    setInventoryError(null);
                  }}
                  placeholder="Search by name or SKU"
                  className="w-full rounded-md border py-2 pl-8 pr-2.5 text-sm outline-none"
                  style={{ borderColor: 'var(--border-muted)', background: 'var(--surface-primary)' }}
                />
              </div>
            </label>

            <div
              className="mt-3 rounded-md border"
              style={{ borderColor: 'var(--border-muted)', background: 'var(--surface-primary)' }}
            >
              {isProductsPending ? (
                <div className="flex items-center justify-center px-3 py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
                </div>
              ) : productResults.length === 0 ? (
                <div className="px-3 py-4 text-xs text-[var(--text-muted)]">
                  {isProductsError
                    ? 'Could not load product results.'
                    : 'No catalog products match the current search.'}
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto">
                  {productResults.map((product, index) => {
                    const imageUrl = getProductImageUrl(product);
                    const meta = getProductMeta(product.id, product);
                    const isSelected = product.id === selectedProductId;

                    return (
                      <button
                        key={product.id}
                        type="button"
                        className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors"
                        style={
                          index > 0
                            ? {
                                borderTop: '1px solid var(--border-muted)',
                                background: isSelected ? 'var(--surface-subtle)' : 'transparent'
                              }
                            : { background: isSelected ? 'var(--surface-subtle)' : 'transparent' }
                        }
                        onClick={() => {
                          setSelectedProductId(product.id);
                          setInventoryError(null);
                        }}
                      >
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={product.name}
                            className="h-10 w-10 rounded-md object-cover"
                          />
                        ) : (
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-md text-[10px] text-[var(--text-muted)]"
                            style={{ background: 'var(--surface-subtle)' }}
                          >
                            No img
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                            {product.name}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">
                            {meta ?? product.externalProductId}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {activeProduct && (
              <div
                className="mt-3 flex items-center gap-3 rounded-md border px-3 py-2"
                style={{ borderColor: 'var(--border-muted)', background: 'var(--surface-primary)' }}
              >
                {getProductImageUrl(activeProduct) ? (
                  <img
                    src={getProductImageUrl(activeProduct)!}
                    alt={activeProduct.name}
                    className="h-12 w-12 rounded-md object-cover"
                  />
                ) : (
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-md text-[10px] text-[var(--text-muted)]"
                    style={{ background: 'var(--surface-subtle)' }}
                  >
                    No img
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                    {activeProduct.name}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">
                    {getProductMeta(activeProduct.id, activeProduct)}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-[var(--text-primary)]">
                Quantity
                <input
                  value={quantityInput}
                  onChange={(event) => setQuantityInput(event.target.value)}
                  inputMode="decimal"
                  className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--border-muted)', background: 'var(--surface-primary)' }}
                />
              </label>
              <label className="block text-xs text-[var(--text-primary)]">
                UOM
                <input
                  value={uomInput}
                  onChange={(event) => setUomInput(event.target.value)}
                  className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--border-muted)', background: 'var(--surface-primary)' }}
                />
              </label>
            </div>

            {inventoryError && <p className="mt-2 text-xs text-red-500">{inventoryError}</p>}

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className="rounded-md px-3 py-2 text-xs font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: 'var(--accent)' }}
                onClick={() => void handleAddInventory()}
                disabled={
                  addInventoryItem.isPending ||
                  !activeProduct ||
                  quantityValue === null ||
                  uomInput.trim().length === 0
                }
              >
                {addInventoryItem.isPending ? 'Saving...' : 'Confirm inventory'}
              </button>
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-xs font-medium text-[var(--text-muted)]"
                style={{ borderColor: 'var(--border-muted)' }}
                onClick={() => {
                  setIsAddInventoryOpen(false);
                  setInventoryError(null);
                }}
                disabled={addInventoryItem.isPending}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {isRemoveConfirmOpen && sourceCellId && (
          <div
            className="rounded-lg p-3"
            style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-muted)' }}
          >
            <p className="text-xs text-[var(--text-primary)]">
              Remove this container from the current cell?
            </p>
            {removeError && <p className="mt-2 text-xs text-red-500">{removeError}</p>}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className="rounded-md px-3 py-2 text-xs font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: 'var(--danger)' }}
                onClick={() => void handleRemove()}
                disabled={removeContainer.isPending}
              >
                Confirm remove
              </button>
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-xs font-medium text-[var(--text-muted)]"
                style={{ borderColor: 'var(--border-muted)' }}
                onClick={() => {
                  setIsRemoveConfirmOpen(false);
                  setRemoveError(null);
                }}
                disabled={removeContainer.isPending}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {isAddInventoryOpen && identity && (
          <div
            className="rounded-lg p-3"
            style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-muted)' }}
          >
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--accent)]">
              Add inventory
            </p>
            <div className="mt-3 grid gap-3">
              <label className="grid gap-1">
                <span className="text-[11px] font-medium text-[var(--text-primary)]">SKU / item reference</span>
                <input
                  value={skuInput}
                  onChange={(event) => setSkuInput(event.target.value)}
                  placeholder="CAMP-CHAIR-01"
                  className="rounded-md border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--border-muted)', background: 'var(--surface-primary)' }}
                  disabled={addInventoryToContainer.isPending}
                />
              </label>
              <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3">
                <label className="grid gap-1">
                  <span className="text-[11px] font-medium text-[var(--text-primary)]">Quantity</span>
                  <input
                    value={quantityInput}
                    onChange={(event) => setQuantityInput(event.target.value)}
                    inputMode="decimal"
                    placeholder="12"
                    className="rounded-md border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--border-muted)', background: 'var(--surface-primary)' }}
                    disabled={addInventoryToContainer.isPending}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[11px] font-medium text-[var(--text-primary)]">UOM</span>
                  <input
                    value={uomInput}
                    onChange={(event) => setUomInput(event.target.value)}
                    placeholder="ea"
                    className="rounded-md border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--border-muted)', background: 'var(--surface-primary)' }}
                    disabled={addInventoryToContainer.isPending}
                  />
                </label>
              </div>
            </div>

            {addInventoryError && <p className="mt-3 text-xs text-red-500">{addInventoryError}</p>}

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className="rounded-md px-3 py-2 text-xs font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: 'var(--accent)' }}
                onClick={() => void handleAddInventory()}
                disabled={addInventoryToContainer.isPending}
              >
                {addInventoryToContainer.isPending ? 'Saving...' : 'Confirm add'}
              </button>
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-xs font-medium text-[var(--text-muted)]"
                style={{ borderColor: 'var(--border-muted)' }}
                onClick={() => {
                  setIsAddInventoryOpen(false);
                  setAddInventoryError(null);
                }}
                disabled={addInventoryToContainer.isPending}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {isPending && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
          </div>
        )}

        {isError && (
          <div
            className="rounded-lg px-3 py-3 text-center"
            style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-muted)' }}
          >
            <AlertCircle className="mx-auto mb-1.5 h-5 w-5 text-red-400" />
            <p className="text-xs text-slate-500">Could not load container data.</p>
            <p className="mt-0.5 text-[11px] text-slate-400">Check your connection and try again.</p>
          </div>
        )}

        {!isPending && !isError && rows && rows.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <AlertCircle className="h-7 w-7 text-slate-300" />
            <div>
              <p className="text-sm font-medium text-slate-600">Container not found</p>
              <p className="mt-1 text-xs text-slate-400">No data is available for this container.</p>
            </div>
          </div>
        )}

        {!isPending && !isError && identity && (
          <>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Inventory
            </p>

            {inventory.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <PackageOpen className="h-7 w-7 text-slate-300" />
                <p className="text-xs text-slate-400">This container has no inventory items.</p>
              </div>
            ) : (
              <div
                className="rounded-lg"
                style={{
                  border: '1px solid var(--border-muted)',
                  background: 'var(--surface-subtle)'
                }}
              >
                {inventory.map((item, index) => {
                  const imageUrl = getProductImageUrl(item.product);
                  const meta = getProductMeta(item.itemRef, item.product);

                  return (
                    <div
                      key={`${item.itemRef}-${index}`}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                      style={index > 0 ? { borderTop: '1px solid var(--border-muted)' } : undefined}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={getProductLabel(item.itemRef, item.product)}
                            className="h-10 w-10 rounded-md object-cover"
                          />
                        ) : (
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-md text-[10px] text-[var(--text-muted)]"
                            style={{ background: 'var(--surface-primary)' }}
                          >
                            Item
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                            {getProductLabel(item.itemRef, item.product)}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">
                            {meta}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-[var(--text-muted)]">
                        {item.quantity} {item.uom}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
