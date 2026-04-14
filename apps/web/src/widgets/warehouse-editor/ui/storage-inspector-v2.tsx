import type { ContainerType, FloorWorkspace, LocationStorageSnapshotRow, Product, Rack, RackInspectorPayload } from '@wos/domain';
import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { useContainerTypes } from '@/entities/container/api/use-container-types';
import { useLocationByCell } from '@/entities/location/api/use-location-by-cell';
import { locationKeys } from '@/entities/location/api/queries';
import { useLocationStorage } from '@/entities/location/api/use-location-storage';
import { useProductsSearch } from '@/entities/product/api/use-products-search';
import { useRackInspector } from '@/entities/rack/api/use-rack-inspector';
import { createContainer } from '@/features/container-create/api/mutations';
import { addInventoryItem } from '@/features/inventory-add/api/mutations';
import { moveContainer as moveContainerApi, placeContainer } from '@/features/placement-actions/api/mutations';
import { invalidatePlacementQueries } from '@/features/placement-actions/model/invalidation';
import { containerKeys } from '@/entities/container/api/queries';
import {
  useStorageFocusSelectedCellId,
  useStorageFocusSelectedRackId,
  useStorageFocusActiveLevel,
  useStorageFocusSelectCell,
} from '../model/v2/v2-selectors';

/**
 * StorageInspectorV2 — Right surface for the V2 storage path.
 *
 * Panel modes (PR3):
 * - empty                             — no rack, no cell selected
 * - rack-overview                     — rack selected, no cell drilled in
 * - cell-overview                     — cell selected; shows containers + inventory preview + actions
 * - container-detail                  — local drill-down into one container; back → cell-overview
 * - task-create-container             — create empty container at selected cell (PR3)
 * - task-create-container-with-product — create container + initial product (PR3)
 *
 * State ownership:
 * - selectedRackId, selectedCellId, activeLevel → StorageFocusStore (global, spatial)
 * - selectedContainerId → local useState (panel-only, never escapes)
 * - taskKind → local useState (panel-only, never escapes, resets on cellId change)
 *
 * Cell data path is fetched once at the top level and shared between
 * cell-overview, container-detail, and task panels — no duplicate query orchestration.
 *
 * Fields NOT available in current BFF responses — explicitly omitted:
 * - capacityMode, policy, retentionDays
 */

interface StorageInspectorV2Props {
  workspace: FloorWorkspace | null;
}

const INVENTORY_PREVIEW_LIMIT = 3;

// ── Panel mode model ───────────────────────────────────────────────────────────

type PanelMode =
  | { kind: 'empty' }
  | { kind: 'rack-overview'; rackId: string }
  | { kind: 'cell-overview'; cellId: string }
  | { kind: 'container-detail'; cellId: string; containerId: string }
  | { kind: 'task-create-container'; cellId: string }
  | { kind: 'task-create-container-with-product'; cellId: string }
  | { kind: 'task-move-container'; sourceContainerId: string; sourceCellId: string };

type TaskKind = 'create-container' | 'create-container-with-product' | 'move-container';

/**
 * Local task state for the move-container flow.
 * sourceContainerDisplayCode and sourceLocationCode are captured at task start
 * so they survive the user browsing away to select a target cell.
 * targetLocationId is resolved inside MoveContainerTaskPanel (not stored here).
 */
export type MoveTaskState = {
  sourceContainerId: string;
  sourceCellId: string;
  sourceLocationId: string;
  sourceRackId: string | null;
  sourceLevel: number | null;
  sourceLocationCode: string;
  sourceContainerDisplayCode: string;
  /** Local move target — updated via effect when user clicks cells during task. */
  targetCellId: string | null;
  /** Single source of truth for task progression (not duplicated in panel). */
  stage: 'selecting-target' | 'moving' | 'success' | 'error';
  errorMessage: string | null;
};

/**
 * Derives the current panel mode from spatial focus state and local container selection.
 * Pure function — exported for isolated testing.
 *
 * Priority: container-detail > cell-overview > rack-overview > empty
 * containerId only activates when cellId is also set (it is local to the cell panel).
 */
export function resolvePanelMode(
  rackId: string | null,
  cellId: string | null,
  containerId: string | null
): PanelMode {
  if (cellId && containerId) return { kind: 'container-detail', cellId, containerId };
  if (cellId) return { kind: 'cell-overview', cellId };
  if (rackId) return { kind: 'rack-overview', rackId };
  return { kind: 'empty' };
}

/**
 * Applies a task override on top of the base panel mode.
 * Move task overrides all base modes (incl. container-detail).
 * Create tasks only activate when the base mode is cell-overview.
 * Pure function — exported for isolated testing.
 */
export function resolveActiveMode(
  base: PanelMode,
  taskKind: TaskKind | null,
  moveTaskState: MoveTaskState | null = null
): PanelMode {
  if (taskKind === 'move-container' && moveTaskState !== null)
    return { kind: 'task-move-container', sourceContainerId: moveTaskState.sourceContainerId, sourceCellId: moveTaskState.sourceCellId };
  if (base.kind === 'cell-overview' && taskKind === 'create-container')
    return { kind: 'task-create-container', cellId: base.cellId };
  if (base.kind === 'cell-overview' && taskKind === 'create-container-with-product')
    return { kind: 'task-create-container-with-product', cellId: base.cellId };
  return base;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Group snapshot rows by containerId. Returns array of { containerId, rows }. */
function groupByContainer(
  rows: LocationStorageSnapshotRow[]
): Array<{ containerId: string; rows: LocationStorageSnapshotRow[] }> {
  const map = new Map<string, LocationStorageSnapshotRow[]>();
  for (const row of rows) {
    const existing = map.get(row.containerId);
    if (existing) {
      existing.push(row);
    } else {
      map.set(row.containerId, [row]);
    }
  }
  return Array.from(map.entries()).map(([containerId, rows]) => ({ containerId, rows }));
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex-shrink-0">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
    </div>
  );
}

function StatusBadge({ occupied }: { occupied: boolean }) {
  if (occupied) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium bg-red-50 text-red-700 border-red-200">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-red-500" />
        Occupied
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium bg-green-50 text-green-700 border-green-200">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-green-500" />
      Empty
    </span>
  );
}

function InspectorFooter() {
  return (
    <div className="px-4 py-2 border-t border-gray-200 flex-shrink-0 text-xs text-gray-500 bg-gray-50">
      <p>
        <span className="font-medium">PR3:</span> Create container · Create container with product.{' '}
        <span className="font-medium">PR4:</span> Move container.
      </p>
    </div>
  );
}

// ── Task panel shared types & helpers ─────────────────────────────────────────

interface TaskPanelProps {
  locationId: string | null;
  floorId: string | null;
  rackDisplayCode: string;
  locationCode: string;
  activeLevel: number;
  onCancel: () => void;
  onSuccess: () => void;
}

type TaskError = { stage: 'create' | 'place' | 'inventory'; message: string };

function TaskPanelBreadcrumb({
  rackDisplayCode,
  activeLevel,
  locationCode,
}: {
  rackDisplayCode: string;
  activeLevel: number;
  locationCode: string;
}) {
  return (
    <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap leading-relaxed">
      <span>{rackDisplayCode}</span>
      <span className="text-gray-300">/</span>
      <span>Level {activeLevel}</span>
      <span className="text-gray-300">/</span>
      <span className="font-mono text-gray-900 font-medium">{locationCode}</span>
    </div>
  );
}

function ContainerTypeSelect({
  containerTypes,
  value,
  onChange,
  disabled,
}: {
  containerTypes: ContainerType[];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
}) {
  const storableTypes = containerTypes.filter((t) => t.supportsStorage);
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-700">
        Container type <span className="text-red-500">*</span>
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || storableTypes.length === 0}
        className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        aria-label="Container type"
      >
        <option value="">Select type…</option>
        {storableTypes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.description} ({t.code})
          </option>
        ))}
      </select>
    </div>
  );
}

// ── CreateContainerTaskPanel ──────────────────────────────────────────────────

function CreateContainerTaskPanel({
  locationId,
  floorId,
  rackDisplayCode,
  locationCode,
  activeLevel,
  onCancel,
  onSuccess,
}: TaskPanelProps) {
  const queryClient = useQueryClient();
  const { data: containerTypes = [] } = useContainerTypes();
  const [containerTypeId, setContainerTypeId] = useState('');
  const [externalCode, setExternalCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<TaskError | null>(null);

  const canSubmit = Boolean(containerTypeId) && Boolean(locationId) && !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit || !locationId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      let containerId: string;
      try {
        const result = await createContainer({
          containerTypeId,
          externalCode: externalCode.trim() || undefined,
        });
        containerId = result.containerId;
      } catch {
        setError({ stage: 'create', message: 'Failed to create container.' });
        return;
      }
      try {
        await placeContainer({ containerId, locationId });
      } catch {
        setError({ stage: 'place', message: 'Failed to place container at this location.' });
        return;
      }
      await invalidatePlacementQueries(queryClient, { floorId, containerId });
      await queryClient.invalidateQueries({ queryKey: locationKeys.storage(locationId) });
      onSuccess();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden"
      role="complementary"
      aria-label="Create container"
    >
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mb-2 disabled:opacity-50"
          aria-label="Cancel create container"
        >
          ← Cancel
        </button>
        <TaskPanelBreadcrumb
          rackDisplayCode={rackDisplayCode}
          activeLevel={activeLevel}
          locationCode={locationCode}
        />
        <p className="text-sm font-semibold text-gray-900 mt-1">Create container</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <ContainerTypeSelect
          containerTypes={containerTypes}
          value={containerTypeId}
          onChange={setContainerTypeId}
          disabled={isSubmitting}
        />
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">
            External code <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={externalCode}
            onChange={(e) => setExternalCode(e.target.value)}
            disabled={isSubmitting}
            placeholder="e.g. PLT-0042"
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            aria-label="External code"
          />
        </div>

        {!locationId && (
          <p className="text-xs text-gray-400">Resolving location…</p>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error.message}
          </p>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-200 flex gap-2 flex-shrink-0">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Confirm create container"
        >
          {isSubmitting ? 'Creating…' : 'Create container'}
        </button>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── CreateContainerWithProductTaskPanel ───────────────────────────────────────

function CreateContainerWithProductTaskPanel({
  locationId,
  floorId,
  rackDisplayCode,
  locationCode,
  activeLevel,
  onCancel,
  onSuccess,
}: TaskPanelProps) {
  const queryClient = useQueryClient();
  const { data: containerTypes = [] } = useContainerTypes();
  const [containerTypeId, setContainerTypeId] = useState('');
  const [externalCode, setExternalCode] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('');
  const [uom, setUom] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<TaskError | null>(null);

  const { data: searchResults = [] } = useProductsSearch(productSearch.trim() || null);
  const showResults = productSearch.trim().length > 0 && !selectedProduct;

  const canSubmit =
    Boolean(containerTypeId) &&
    Boolean(locationId) &&
    selectedProduct !== null &&
    quantity.trim() !== '' &&
    Number(quantity) > 0 &&
    uom.trim() !== '' &&
    !isSubmitting;

  function selectProduct(product: Product) {
    setSelectedProduct(product);
    setProductSearch(product.name ?? product.sku ?? '');
  }

  async function handleSubmit() {
    if (!canSubmit || !locationId || !selectedProduct) return;
    setIsSubmitting(true);
    setError(null);
    try {
      let containerId: string;
      try {
        const result = await createContainer({
          containerTypeId,
          externalCode: externalCode.trim() || undefined,
        });
        containerId = result.containerId;
      } catch {
        setError({ stage: 'create', message: 'Failed to create container.' });
        return;
      }
      try {
        await placeContainer({ containerId, locationId });
      } catch {
        setError({ stage: 'place', message: 'Failed to place container at this location.' });
        return;
      }
      try {
        await addInventoryItem({
          containerId,
          productId: selectedProduct.id,
          quantity: Number(quantity),
          uom: uom.trim(),
        });
      } catch {
        // Container was created and placed — surface the partial state honestly.
        await queryClient.invalidateQueries({ queryKey: locationKeys.storage(locationId) });
        setError({
          stage: 'inventory',
          message:
            'Container was created and placed, but inventory could not be added. The container is now empty at this location.',
        });
        return;
      }
      await invalidatePlacementQueries(queryClient, { floorId, containerId });
      await queryClient.invalidateQueries({ queryKey: locationKeys.storage(locationId) });
      onSuccess();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden"
      role="complementary"
      aria-label="Create container with product"
    >
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mb-2 disabled:opacity-50"
          aria-label="Cancel create container with product"
        >
          ← Cancel
        </button>
        <TaskPanelBreadcrumb
          rackDisplayCode={rackDisplayCode}
          activeLevel={activeLevel}
          locationCode={locationCode}
        />
        <p className="text-sm font-semibold text-gray-900 mt-1">Create container with product</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <ContainerTypeSelect
          containerTypes={containerTypes}
          value={containerTypeId}
          onChange={setContainerTypeId}
          disabled={isSubmitting}
        />
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">
            External code <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={externalCode}
            onChange={(e) => setExternalCode(e.target.value)}
            disabled={isSubmitting}
            placeholder="e.g. PLT-0042"
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            aria-label="External code"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">
            Product <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={productSearch}
            onChange={(e) => {
              setProductSearch(e.target.value);
              setSelectedProduct(null);
            }}
            disabled={isSubmitting}
            placeholder="Search by name or SKU…"
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            aria-label="Product search"
          />
          {showResults && searchResults.length > 0 && (
            <ul className="border border-gray-200 rounded bg-white shadow-sm max-h-36 overflow-y-auto" role="listbox" aria-label="Product search results">
              {searchResults.slice(0, 10).map((p) => (
                <li
                  key={p.id}
                  role="option"
                  aria-selected={false}
                  onClick={() => selectProduct(p)}
                  className="px-3 py-2 text-xs cursor-pointer hover:bg-blue-50 flex items-baseline gap-2"
                >
                  <span className="font-mono text-gray-500">{p.sku}</span>
                  <span className="text-gray-700 truncate">{p.name}</span>
                </li>
              ))}
            </ul>
          )}
          {selectedProduct && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
              <span className="font-mono">{selectedProduct.sku}</span>
              {selectedProduct.name && <span className="ml-1.5">{selectedProduct.name}</span>}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              Quantity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0.001"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={isSubmitting}
              placeholder="0"
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              aria-label="Quantity"
            />
          </div>
          <div className="w-24 space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              UOM <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={uom}
              onChange={(e) => setUom(e.target.value)}
              disabled={isSubmitting}
              placeholder="EA"
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              aria-label="Unit of measure"
            />
          </div>
        </div>

        {!locationId && (
          <p className="text-xs text-gray-400">Resolving location…</p>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error.message}
          </p>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-200 flex gap-2 flex-shrink-0">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Confirm create container with product"
        >
          {isSubmitting ? 'Creating…' : 'Create container'}
        </button>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden">
      <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <svg
            className="w-6 h-6 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-700">No location selected</p>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          Select a location from the navigator to view details
        </p>
      </div>
      <InspectorFooter />
    </div>
  );
}

// ── Loading state ──────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden">
      <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
        <p className="text-sm text-gray-400">Loading location…</p>
      </div>
      <InspectorFooter />
    </div>
  );
}

// ── Rack overview (rack selected, no cell drilled in) ─────────────────────────

function OccupancyBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

function RackOverviewPanel({ rackId }: { rackId: string }) {
  const { data, isLoading, isError } = useRackInspector(rackId);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden">
        <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
          <p className="text-sm text-gray-400">Loading rack…</p>
        </div>
        <InspectorFooter />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden">
        <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
          <p className="text-sm text-red-500">Failed to load rack data</p>
        </div>
        <InspectorFooter />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden"
      role="complementary"
      aria-label={`Rack overview: ${data.displayCode}`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="font-mono font-semibold text-gray-900">{data.displayCode}</span>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="capitalize">{data.kind}</span>
            <span className="text-gray-300">·</span>
            <span>{data.axis}</span>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* Occupancy summary */}
        <SectionHeader title="Occupancy" />
        <div className="px-4 py-3 border-b border-gray-200 space-y-2">
          <OccupancyBar rate={data.occupancySummary.occupancyRate} />
          <div className="text-xs text-gray-500">
            {data.occupancySummary.occupiedCells} / {data.occupancySummary.totalCells} cells occupied
          </div>
        </div>

        {/* Levels breakdown */}
        <SectionHeader title="Levels" />
        <div className="px-4 py-3 space-y-1.5">
          {data.levels.map((level) => (
            <div key={level.levelOrdinal} className="flex justify-between items-center text-xs text-gray-700">
              <span className="font-medium">L{level.levelOrdinal}:</span>
              <span className="text-gray-500">
                {level.occupiedCells}/{level.totalCells}
              </span>
            </div>
          ))}
        </div>
      </div>

      <InspectorFooter />
    </div>
  );
}

// ── MoveContainerTaskPanel ────────────────────────────────────────────────────

interface MoveContainerTaskPanelProps {
  moveTaskState: MoveTaskState;
  floorId: string | null;
  rackDisplayCode: string;
  onStageChange: (stage: MoveTaskState['stage'], error?: string | null) => void;
  onCancel: () => void;
  onDone: () => void;
}

function MoveContainerTaskPanel({
  moveTaskState,
  floorId,
  rackDisplayCode,
  onStageChange,
  onCancel,
  onDone,
}: MoveContainerTaskPanelProps) {
  const queryClient = useQueryClient();

  // Resolve target location from the local targetCellId.
  const { data: targetLocationRef, isLoading: targetLocationLoading } = useLocationByCell(
    moveTaskState.targetCellId
  );
  const resolvedTargetLocationId = targetLocationRef?.locationId ?? null;

  const isTargetSameAsSource = moveTaskState.targetCellId === moveTaskState.sourceCellId;
  const canConfirm =
    moveTaskState.targetCellId !== null &&
    !isTargetSameAsSource &&
    resolvedTargetLocationId !== null &&
    moveTaskState.stage === 'selecting-target';

  const handleConfirm = async () => {
    if (!resolvedTargetLocationId) return;
    onStageChange('moving');
    try {
      await moveContainerApi({
        containerId: moveTaskState.sourceContainerId,
        targetLocationId: resolvedTargetLocationId,
      });
      await invalidatePlacementQueries(queryClient, {
        floorId,
        sourceCellId: moveTaskState.sourceCellId,
        containerId: moveTaskState.sourceContainerId,
      });
      await queryClient.invalidateQueries({
        queryKey: containerKeys.currentLocation(moveTaskState.sourceContainerId),
      });
      onStageChange('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Move failed. Please try again.';
      onStageChange('error', message);
    }
  };

  const isMoving = moveTaskState.stage === 'moving';

  return (
    <div
      className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden"
      role="complementary"
      aria-label="Move container"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        {moveTaskState.stage !== 'success' && (
          <button
            onClick={onCancel}
            disabled={isMoving}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mb-2 disabled:opacity-50"
            aria-label="Cancel move container"
          >
            ← Cancel
          </button>
        )}
        <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap leading-relaxed">
          <span>{rackDisplayCode}</span>
          <span className="text-gray-300">/</span>
          <span className="font-mono text-gray-900 font-medium">{moveTaskState.sourceLocationCode}</span>
        </div>
        <p className="text-sm font-semibold text-gray-900 mt-1">Move container</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Container being moved */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Container</p>
          <p className="font-mono text-sm font-semibold text-gray-900">
            {moveTaskState.sourceContainerDisplayCode}
          </p>
        </div>

        {/* Source */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">From</p>
          <p className="font-mono text-sm text-gray-700">{moveTaskState.sourceLocationCode}</p>
        </div>

        {/* Target */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">To</p>
          {moveTaskState.targetCellId === null ? (
            <p className="text-sm text-gray-400 italic" data-testid="move-target-placeholder">
              Click a cell on the canvas to select a target location
            </p>
          ) : isTargetSameAsSource ? (
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Same as source — choose a different cell
            </p>
          ) : targetLocationLoading ? (
            <p className="text-sm text-gray-400">Resolving location…</p>
          ) : (
            <p className="font-mono text-sm text-gray-700" data-testid="move-target-selected">
              {resolvedTargetLocationId ? moveTaskState.targetCellId : '—'}
            </p>
          )}
        </div>

        {/* Moving spinner */}
        {moveTaskState.stage === 'moving' && (
          <p className="text-sm text-gray-500">Moving container…</p>
        )}

        {/* Success — policy reconciliation notice */}
        {moveTaskState.stage === 'success' && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-green-700" data-testid="move-success-message">
              Container moved successfully.
            </p>
            <div
              className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs text-amber-800 space-y-1"
              data-testid="policy-reconciliation-notice"
            >
              <p className="font-medium">Policy review required</p>
              <p>
                Location-level storage policy is not transferred automatically. Review source and
                target location policies if needed.
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {moveTaskState.stage === 'error' && moveTaskState.errorMessage && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {moveTaskState.errorMessage}
          </p>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-4 py-3 border-t border-gray-200 flex gap-2 flex-shrink-0">
        {moveTaskState.stage === 'success' ? (
          <button
            onClick={onDone}
            className="flex-1 px-3 py-2 text-sm font-medium bg-green-600 text-white rounded hover:bg-green-700"
            data-testid="move-done-button"
          >
            Done
          </button>
        ) : moveTaskState.stage === 'error' ? (
          <>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Retry
            </button>
            <button
              onClick={onCancel}
              className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Confirm move container"
              data-testid="move-confirm-button"
            >
              {isMoving ? 'Moving…' : 'Confirm move'}
            </button>
            <button
              onClick={onCancel}
              disabled={isMoving}
              className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function StorageInspectorV2({ workspace }: StorageInspectorV2Props) {
  const racks: Record<string, Rack> | undefined = workspace?.latestPublished?.racks;
  const floorId = workspace?.floorId ?? null;
  const { data: publishedCells = [] } = usePublishedCells(floorId);

  // Spatial focus — from StorageFocusStore, the single V2 runtime focus source.
  const cellId = useStorageFocusSelectedCellId();
  const rackId = useStorageFocusSelectedRackId();
  const activeLevel = useStorageFocusActiveLevel() ?? 1;
  const rackDisplayCode = rackId ? (racks?.[rackId]?.displayCode ?? rackId) : '—';

  // Local container drill-down — panel-only state, never escapes this component.
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
  // Local task flow — panel-only state, never escapes this component.
  const [taskKind, setTaskKind] = useState<TaskKind | null>(null);
  // Local move task state — single source of truth for move flow (stage + frozen source + local target).
  const [moveTaskState, setMoveTaskState] = useState<MoveTaskState | null>(null);

  // Refs hold current values so the effect on [cellId] can read them without stale closures.
  const taskKindRef = useRef<TaskKind | null>(null);
  taskKindRef.current = taskKind;
  const moveTaskRef = useRef<MoveTaskState | null>(null);
  moveTaskRef.current = moveTaskState;

  // Spatial focus action — used by cancel handler to restore source cell.
  const selectCell = useStorageFocusSelectCell();

  // Combined effect: during move task, capture proposed target into local state.
  // During normal browsing, clear panel-local state on cell change.
  useEffect(() => {
    if (taskKindRef.current === 'move-container') {
      const current = moveTaskRef.current;
      if (cellId && current && cellId !== current.sourceCellId) {
        setMoveTaskState((prev) => (prev ? { ...prev, targetCellId: cellId } : null));
      }
      return;
    }
    setSelectedContainerId(null);
    setTaskKind(null);
    setMoveTaskState(null);
  }, [cellId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cell data path — fetched once at top level, shared across cell-overview, container-detail, and task panels.
  // These hooks are no-ops (disabled) when cellId / locationId is null.
  const { data: locationRef, isLoading: locationRefLoading } = useLocationByCell(cellId);
  const locationId = locationRef?.locationId ?? null;
  const { data: storageRows = [], isLoading: storageLoading } = useLocationStorage(locationId);

  const mode = resolveActiveMode(resolvePanelMode(rackId, cellId, selectedContainerId), taskKind, moveTaskState);

  // ── Move task handlers (defined before mode branches so they're available everywhere) ──
  const handleMoveStageChange = (stage: MoveTaskState['stage'], error?: string | null) => {
    setMoveTaskState((prev) => (prev ? { ...prev, stage, errorMessage: error ?? null } : null));
  };

  const handleMoveCancel = () => {
    const source = moveTaskState!;
    setTaskKind(null);
    setMoveTaskState(null);
    setSelectedContainerId(null);
    selectCell({ cellId: source.sourceCellId, rackId: source.sourceRackId ?? undefined, level: source.sourceLevel ?? undefined });
  };

  const handleMoveDone = () => {
    const movedContainerId = moveTaskState!.sourceContainerId;
    // cellId is already at target; not changing it → cleanup effect does not fire → selectedContainerId survives.
    setTaskKind(null);
    setMoveTaskState(null);
    setSelectedContainerId(movedContainerId);
  };

  // ── empty ──────────────────────────────────────────────────────────────────
  if (mode.kind === 'empty') {
    return <EmptyState />;
  }

  // ── rack-overview ──────────────────────────────────────────────────────────
  if (mode.kind === 'rack-overview') {
    return <RackOverviewPanel rackId={mode.rackId} />;
  }

  // ── task-move-container — checked before loading state so panel persists while target cell loads ──
  if (mode.kind === 'task-move-container') {
    return (
      <MoveContainerTaskPanel
        moveTaskState={moveTaskState!}
        floorId={floorId}
        rackDisplayCode={rackDisplayCode}
        onStageChange={handleMoveStageChange}
        onCancel={handleMoveCancel}
        onDone={handleMoveDone}
      />
    );
  }

  // ── cell-overview / container-detail — shared cell data path ──────────────
  if (locationRefLoading || (locationId && storageLoading)) {
    return <LoadingState />;
  }

  const selectedCellAddress = publishedCells.find((cell) => cell.id === cellId)?.address.raw ?? null;
  // Breadcrumb: prefer real locationCode, then semantic cell address, then raw id.
  const locationCode = storageRows[0]?.locationCode ?? selectedCellAddress ?? cellId;
  const isOccupied = storageRows.length > 0;
  const containers = groupByContainer(storageRows);

  // ── task-create-container ──────────────────────────────────────────────────
  if (mode.kind === 'task-create-container') {
    return (
      <CreateContainerTaskPanel
        locationId={locationId}
        floorId={floorId}
        rackDisplayCode={rackDisplayCode}
        locationCode={locationCode}
        activeLevel={activeLevel}
        onCancel={() => setTaskKind(null)}
        onSuccess={() => setTaskKind(null)}
      />
    );
  }

  // ── task-create-container-with-product ─────────────────────────────────────
  if (mode.kind === 'task-create-container-with-product') {
    return (
      <CreateContainerWithProductTaskPanel
        locationId={locationId}
        floorId={floorId}
        rackDisplayCode={rackDisplayCode}
        locationCode={locationCode}
        activeLevel={activeLevel}
        onCancel={() => setTaskKind(null)}
        onSuccess={() => setTaskKind(null)}
      />
    );
  }

  // ── container-detail ───────────────────────────────────────────────────────
  if (mode.kind === 'container-detail') {
    const containerRows = storageRows.filter((r) => r.containerId === mode.containerId);
    const first = containerRows[0];
    const displayCode = first ? (first.externalCode ?? first.systemCode) : mode.containerId;
    const items = containerRows.filter((r) => r.itemRef !== null || r.quantity !== null);

    return (
      <div
        className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden"
        role="complementary"
        aria-label={`Container detail: ${displayCode}`}
      >
        {/* Header with back */}
        <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <button
            onClick={() => setSelectedContainerId(null)}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mb-2"
            aria-label="Back to cell overview"
          >
            ← Back
          </button>
          <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap leading-relaxed">
            <span>{rackDisplayCode}</span>
            <span className="text-gray-300">/</span>
            <span>Level {activeLevel}</span>
            <span className="text-gray-300">/</span>
            <span className="font-mono text-gray-900 font-medium">{locationCode}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <SectionHeader title="Container" />
          <div className="px-4 py-3 border-b border-gray-200 space-y-1">
            <div className="font-mono text-sm font-semibold text-gray-900">{displayCode}</div>
            {first && (
              <>
                <div className="text-xs text-gray-500 capitalize">
                  Type: {first.containerType}
                </div>
                <div className="text-xs text-gray-500 capitalize">
                  Status: {first.containerStatus}
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="px-4 py-3 border-b border-gray-200">
            <button
              onClick={() => {
                if (!cellId || !locationId) return;
                setMoveTaskState({
                  sourceContainerId: mode.containerId,
                  sourceCellId: cellId,
                  sourceLocationId: locationId,
                  sourceRackId: rackId,
                  sourceLevel: activeLevel,
                  sourceLocationCode: locationCode,
                  sourceContainerDisplayCode: displayCode,
                  targetCellId: null,
                  stage: 'selecting-target',
                  errorMessage: null,
                });
                setTaskKind('move-container');
              }}
              className="w-full text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded px-3 py-2"
              data-testid="move-container-action"
            >
              Move container
            </button>
          </div>

          <SectionHeader title="Inventory" />
          <div className="px-4 py-3">
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Empty container</p>
            ) : (
              <div className="space-y-1.5">
                {items.map((row, idx) => {
                  const label = row.product?.name ?? row.product?.sku ?? row.itemRef ?? '—';
                  const qty = row.quantity ?? 0;
                  const uom = row.uom ?? '';
                  return (
                    <div
                      key={`${row.containerId}-${row.itemRef ?? idx}`}
                      className="flex items-baseline justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        {row.product?.sku && (
                          <span className="font-mono text-gray-500">{row.product.sku}</span>
                        )}
                        <span className="text-gray-600 ml-1.5 truncate">{label}</span>
                      </div>
                      <span className="font-medium text-gray-700 flex-shrink-0 tabular-nums">
                        {qty} {uom}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <InspectorFooter />
      </div>
    );
  }

  // ── cell-overview ──────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden"
      role="complementary"
      aria-label={`Location inspector: ${locationCode}`}
    >
      {/* Breadcrumb */}
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap leading-relaxed">
          <span>{rackDisplayCode}</span>
          <span className="text-gray-300">/</span>
          <span>Level {activeLevel}</span>
          <span className="text-gray-300">/</span>
          <span className="font-mono text-gray-900 font-medium">{locationCode}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Status Summary */}
        <SectionHeader title="Status" />
        <div className="px-4 py-3 border-b border-gray-200 space-y-2">
          <StatusBadge occupied={isOccupied} />
          {storageRows[0]?.locationType && (
            <div className="text-xs text-gray-600">
              <span className="text-gray-400">Type:</span>{' '}
              {storageRows[0].locationType.replace('_', ' ')}
            </div>
          )}
        </div>

        {/* Current Contents — containers are clickable to drill into container-detail */}
        <SectionHeader title="Current Contents" />
        <div className="px-4 py-3 border-b border-gray-200">
          {!isOccupied ? (
            <p className="text-sm text-gray-400 italic">None</p>
          ) : (
            <div className="space-y-2">
              {containers.map(({ containerId, rows }) => {
                const first = rows[0];
                const displayCode = first.externalCode ?? first.systemCode;
                return (
                  <button
                    key={containerId}
                    onClick={() => setSelectedContainerId(containerId)}
                    className="w-full text-left bg-gray-50 border border-gray-200 rounded px-3 py-2 space-y-1 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                    aria-label={`View container ${displayCode}`}
                  >
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Container
                    </div>
                    <div className="font-mono text-sm font-semibold text-gray-900">
                      {displayCode}
                    </div>
                    <div className="text-xs text-gray-500 capitalize">
                      Status: {first.containerStatus}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Inventory Preview */}
        <SectionHeader title="Inventory" />
        <div className="px-4 py-3">
          {!isOccupied ? (
            <p className="text-sm text-gray-400 italic">0 items</p>
          ) : (
            (() => {
              const allItems = storageRows.filter(
                (row) => row.itemRef !== null || row.quantity !== null
              );
              const preview = allItems.slice(0, INVENTORY_PREVIEW_LIMIT);
              const overflow = allItems.length - INVENTORY_PREVIEW_LIMIT;

              if (allItems.length === 0) {
                return <p className="text-sm text-gray-400 italic">0 items</p>;
              }

              return (
                <div className="space-y-1.5">
                  {preview.map((row, idx) => {
                    const label = row.product?.name ?? row.product?.sku ?? row.itemRef ?? '—';
                    const qty = row.quantity ?? 0;
                    const uom = row.uom ?? '';
                    return (
                      <div
                        key={`${row.containerId}-${row.itemRef ?? idx}`}
                        className="flex items-baseline justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          {row.product?.sku && (
                            <span className="font-mono text-gray-500">{row.product.sku}</span>
                          )}
                          <span className="text-gray-600 ml-1.5 truncate">{label}</span>
                        </div>
                        <span className="font-medium text-gray-700 flex-shrink-0 tabular-nums">
                          {qty} {uom}
                        </span>
                      </div>
                    );
                  })}
                  {overflow > 0 && (
                    <p className="text-xs text-gray-400 pt-0.5">
                      +{overflow} more item{overflow > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              );
            })()
          )}
        </div>

        {/* Location Info section intentionally omitted:
            capacityMode, policy, retentionDays not available in current BFF responses. */}

        {/* Actions */}
        <SectionHeader title="Actions" />
        <div className="px-4 py-3 space-y-2">
          <button
            onClick={() => setTaskKind('create-container')}
            className="w-full text-left px-3 py-2 text-sm rounded border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors"
            aria-label="Create container at this location"
          >
            Create container
          </button>
          <button
            onClick={() => setTaskKind('create-container-with-product')}
            className="w-full text-left px-3 py-2 text-sm rounded border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors"
            aria-label="Create container with product at this location"
          >
            Create container with product
          </button>
        </div>
      </div>

      <InspectorFooter />
    </div>
  );
}
