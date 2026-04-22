import { RefreshCw } from 'lucide-react';
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import type { ProductPackagingLevel, ProductUnitProfile } from '@wos/domain';
import type {
  PackagingEditorRowSemantics
} from './packaging-editor-semantics';
import type { ReplaceProductPackagingLevelItem } from '@/entities/product/api/mutations';
import type { PackagingLevelDraft, PackagingRowField } from './section-editing';

function parsePositiveInt(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const numeric = Number(trimmed);
  if (!Number.isInteger(numeric) || numeric <= 0) return null;
  return numeric;
}

type ProductPackagingSectionProps = {
  packagingLevelsQuery: UseQueryResult<ProductPackagingLevel[], Error>;
  replacePackagingLevelsMutation: UseMutationResult<
    ProductPackagingLevel[],
    Error,
    { productId: string; levels: ReplaceProductPackagingLevelItem[] }
  >;
  unitProfileQuery: UseQueryResult<ProductUnitProfile | null, Error>;
  isPackagingEditing: boolean;
  packagingDraft: PackagingLevelDraft[];
  packagingRowErrors: Record<string, Partial<Record<PackagingRowField, string>>>;
  packagingSectionErrors: string[];
  packagingSaveError: string | null;
  packagingDirty: boolean;
  packagingEditorSemantics: Record<string, PackagingEditorRowSemantics>;
  onBeginEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onAddRow: () => void;
  onRemoveRow: (draftId: string) => void;
  onUpdateRow: (draftId: string, patch: Partial<PackagingLevelDraft>) => void;
};

export function ProductPackagingSection({
  packagingLevelsQuery,
  replacePackagingLevelsMutation,
  unitProfileQuery,
  isPackagingEditing,
  packagingDraft,
  packagingRowErrors,
  packagingSectionErrors,
  packagingSaveError,
  packagingDirty,
  packagingEditorSemantics,
  onBeginEdit,
  onCancelEdit,
  onSave,
  onAddRow,
  onRemoveRow,
  onUpdateRow
}: ProductPackagingSectionProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/60 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-slate-900">Packaging Levels</h2>
        {packagingLevelsQuery.isLoading || packagingLevelsQuery.isError ? null : isPackagingEditing ? (
          <div className="flex items-center gap-2">
            {packagingDirty ? <span className="text-xs font-medium text-amber-700">Unsaved changes</span> : null}
            <button
              type="button"
              onClick={onAddRow}
              disabled={replacePackagingLevelsMutation.isPending}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add row
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={replacePackagingLevelsMutation.isPending}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={replacePackagingLevelsMutation.isPending}
              className="rounded-lg bg-cyan-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {replacePackagingLevelsMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onBeginEdit}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit
          </button>
        )}
      </div>

      {packagingLevelsQuery.isLoading ? (
        <div className="flex h-24 items-center justify-center p-4">
          <RefreshCw className="h-4 w-4 animate-spin text-slate-300" />
        </div>
      ) : packagingLevelsQuery.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm text-red-700">
          <span>
            {packagingLevelsQuery.error instanceof Error
              ? packagingLevelsQuery.error.message
              : 'Failed to load packaging levels.'}
          </span>
          <button
            type="button"
            onClick={() => void packagingLevelsQuery.refetch()}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Retry
          </button>
        </div>
      ) : isPackagingEditing ? (
        <div className="space-y-3 p-4">
          {packagingSaveError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {packagingSaveError}
            </div>
          ) : null}

          {packagingSectionErrors.length > 0 ? (
            <ul className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {packagingSectionErrors.map((error, index) => (
                <li key={`${error}-${index}`}>{error}</li>
              ))}
            </ul>
          ) : null}

          {packagingDraft.length === 0 ? (
            <div className="text-sm text-slate-600">
              No rows in draft yet. Add a row and ensure the final set has exactly one base row.
            </div>
          ) : (
            <div className="space-y-3">
              {packagingDraft.map((row) => {
                const rowError = packagingRowErrors[row.draftId] ?? {};
                const rowSemantics = packagingEditorSemantics[row.draftId];
                const unitWeightG = unitProfileQuery.data?.unitWeightG ?? null;
                const parsedBaseQty = parsePositiveInt(rowSemantics?.quantityInputValue ?? row.baseUnitQty);
                const estimatedContentWeightG =
                  unitWeightG !== null && parsedBaseQty !== null ? unitWeightG * parsedBaseQty : null;

                return (
                  <div
                    key={row.draftId}
                    className="rounded-lg border border-slate-200 bg-white p-3"
                    style={{ marginLeft: `${(rowSemantics?.cueIndent ?? 0) * 10}px` }}
                  >
                    <div className="mb-2 flex items-center gap-2 border-l-2 border-cyan-200 pl-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        {rowSemantics?.cueLabel ?? 'Pack level'}
                      </span>
                      {row.isBase ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          Base unit level
                        </span>
                      ) : null}
                    </div>
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                      <div className="grid gap-3 md:grid-cols-3">
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Code
                          <input
                            value={row.code}
                            onChange={(event) =>
                              onUpdateRow(row.draftId, {
                                code: event.target.value
                              })
                            }
                            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal"
                          />
                          {rowError.code ? <span className="text-xs text-red-700">{rowError.code}</span> : null}
                        </label>

                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Name
                          <input
                            value={row.name}
                            onChange={(event) =>
                              onUpdateRow(row.draftId, {
                                name: event.target.value
                              })
                            }
                            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal"
                          />
                          {rowError.name ? <span className="text-xs text-red-700">{rowError.name}</span> : null}
                        </label>

                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Contains (single units)
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={rowSemantics?.quantityInputValue ?? row.baseUnitQty}
                            disabled={rowSemantics?.quantityInputDisabled ?? false}
                            onChange={(event) =>
                              onUpdateRow(row.draftId, {
                                baseUnitQty: event.target.value
                              })
                            }
                            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600"
                          />
                          {rowError.baseUnitQty ? (
                            <span className="text-xs text-red-700">{rowError.baseUnitQty}</span>
                          ) : null}
                          {rowSemantics ? (
                            <span className="text-xs font-normal text-slate-700">{rowSemantics.equivalentLine}</span>
                          ) : null}
                          {rowSemantics?.containmentLine ? (
                            <span className="text-xs font-normal text-slate-600">{rowSemantics.containmentLine}</span>
                          ) : null}
                          {rowSemantics?.fallbackLine ? (
                            <span className="text-xs font-normal text-amber-700">{rowSemantics.fallbackLine}</span>
                          ) : null}
                          {estimatedContentWeightG !== null ? (
                            <span className="text-xs font-normal text-slate-600">
                              Estimated content weight: {estimatedContentWeightG} g ({unitWeightG} g x {parsedBaseQty})
                            </span>
                          ) : null}
                          {unitWeightG === null ? (
                            <span className="text-xs font-normal text-slate-500">
                              Unit weight not defined. Content estimate unavailable.
                            </span>
                          ) : null}
                        </label>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <label className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={row.isBase}
                            onChange={(event) =>
                              onUpdateRow(row.draftId, {
                                isBase: event.target.checked
                              })
                            }
                          />
                          Base level
                        </label>
                        <label className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={row.isDefaultPickUom}
                            onChange={(event) =>
                              onUpdateRow(row.draftId, {
                                isDefaultPickUom: event.target.checked
                              })
                            }
                          />
                          Default pick level
                        </label>
                        <label className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={row.canPick}
                            onChange={(event) =>
                              onUpdateRow(row.draftId, {
                                canPick: event.target.checked
                              })
                            }
                          />
                          canPick
                        </label>
                        <label className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={row.canStore}
                            onChange={(event) =>
                              onUpdateRow(row.draftId, {
                                canStore: event.target.checked
                              })
                            }
                          />
                          canStore
                        </label>
                        <label className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={row.isActive}
                            onChange={(event) =>
                              onUpdateRow(row.draftId, {
                                isActive: event.target.checked
                              })
                            }
                          />
                          Active
                        </label>
                        <button
                          type="button"
                          onClick={() => onRemoveRow(row.draftId)}
                          className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-700">
                        Advanced
                      </summary>
                      <div className="grid gap-3 border-t border-slate-200 p-3 md:grid-cols-2 lg:grid-cols-5">
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Barcode
                          <input
                            value={row.barcode}
                            onChange={(event) =>
                              onUpdateRow(row.draftId, {
                                barcode: event.target.value
                              })
                            }
                            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal"
                          />
                        </label>

                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Manual pack weight (g)
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={row.packWeightG}
                            onChange={(event) =>
                              onUpdateRow(row.draftId, {
                                packWeightG: event.target.value
                              })
                            }
                            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal"
                          />
                          {rowError.packWeightG ? (
                            <span className="text-xs text-red-700">{rowError.packWeightG}</span>
                          ) : null}
                          {estimatedContentWeightG !== null ? (
                            <span className="text-xs font-normal text-slate-600">
                              Estimated content only: {estimatedContentWeightG} g
                            </span>
                          ) : null}
                        </label>

                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Pack width (mm)
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={row.packWidthMm}
                            onChange={(event) =>
                              onUpdateRow(row.draftId, {
                                packWidthMm: event.target.value
                              })
                            }
                            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal"
                          />
                          {rowError.packWidthMm ? (
                            <span className="text-xs text-red-700">{rowError.packWidthMm}</span>
                          ) : null}
                        </label>

                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Pack height (mm)
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={row.packHeightMm}
                            onChange={(event) =>
                              onUpdateRow(row.draftId, {
                                packHeightMm: event.target.value
                              })
                            }
                            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal"
                          />
                          {rowError.packHeightMm ? (
                            <span className="text-xs text-red-700">{rowError.packHeightMm}</span>
                          ) : null}
                        </label>

                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Pack depth (mm)
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={row.packDepthMm}
                            onChange={(event) =>
                              onUpdateRow(row.draftId, {
                                packDepthMm: event.target.value
                              })
                            }
                            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal"
                          />
                          {rowError.packDepthMm ? (
                            <span className="text-xs text-red-700">{rowError.packDepthMm}</span>
                          ) : null}
                        </label>
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : !packagingLevelsQuery.data || packagingLevelsQuery.data.length === 0 ? (
        <div className="px-4 py-5 text-sm text-slate-600">Packaging levels not defined yet.</div>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Base qty</th>
                <th className="px-4 py-2.5">Markers</th>
                <th className="px-4 py-2.5">canPick</th>
                <th className="px-4 py-2.5">canStore</th>
                <th className="px-4 py-2.5">Barcode</th>
                <th className="px-4 py-2.5">Dimensions / Weight</th>
                <th className="px-4 py-2.5">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {packagingLevelsQuery.data.map((level) => (
                <tr key={level.id}>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{level.code}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{level.name}</td>
                  <td className="px-4 py-2.5 text-slate-700">{level.baseUnitQty}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {level.isBase && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          Base
                        </span>
                      )}
                      {level.isDefaultPickUom && (
                        <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-700">
                          Default pick
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{level.canPick ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2.5 text-slate-700">{level.canStore ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{level.barcode ?? 'Not defined'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">
                    {level.packWidthMm && level.packHeightMm && level.packDepthMm
                      ? `${level.packWidthMm}x${level.packHeightMm}x${level.packDepthMm} mm`
                      : 'Dims: not defined'}
                    <br />
                    {level.packWeightG ? `Weight: ${level.packWeightG} g` : 'Weight: not defined'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={[
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        level.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                      ].join(' ')}
                    >
                      {level.isActive ? 'active' : 'inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
