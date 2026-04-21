import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { ProductUnitProfile } from '@wos/domain';
import {
  useReplaceProductPackagingLevels,
  useUpsertProductUnitProfile
} from '@/entities/product/api/mutations';
import {
  productPackagingLevelsQueryOptions,
  productQueryOptions,
  productUnitProfileQueryOptions
} from '@/entities/product/api/queries';
import { BffRequestError } from '@/shared/api/bff/client';
import { routes } from '@/shared/config/routes';
import {
  buildPackagingLevelsComparable,
  buildUnitProfileComparable,
  createEmptyPackagingLevelDraft,
  createPackagingLevelDraft,
  createUnitProfileDraft,
  type PackagingLevelDraft,
  type PackagingRowField,
  type UnitProfileNumericField,
  validatePackagingLevelsDraft,
  validateUnitProfileDraft
} from './section-editing';

function formatClass(value: string | null) {
  if (!value) return 'Not defined';
  return value.replace(/_/g, ' ');
}

function formatMeasurement(value: number | null, unit: string) {
  if (value === null) return 'Not defined';
  return `${value} ${unit}`;
}

function getProfileCompleteness(profile: ProductUnitProfile | null | undefined) {
  if (!profile) return 'Missing';
  const hasExact =
    profile.unitWeightG !== null &&
    profile.unitWidthMm !== null &&
    profile.unitHeightMm !== null &&
    profile.unitDepthMm !== null;
  return hasExact ? 'Complete' : 'Partial';
}

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo =
    typeof (location.state as { from?: string } | null)?.from === 'string'
      ? ((location.state as { from: string }).from ?? routes.products)
      : routes.products;

  const productQuery = useQuery(productQueryOptions(productId ?? null));
  const product = productQuery.data ?? null;

  const sectionQueriesEnabled = Boolean(productId) && Boolean(product);

  const unitProfileQuery = useQuery({
    ...productUnitProfileQueryOptions(productId ?? null),
    enabled: sectionQueriesEnabled
  });

  const packagingLevelsQuery = useQuery({
    ...productPackagingLevelsQueryOptions(productId ?? null),
    enabled: sectionQueriesEnabled
  });

  const productError = productQuery.error;
  const isNotFound =
    productError instanceof BffRequestError && productError.status === 404;

  const defaultPickLevel = packagingLevelsQuery.data?.find((level) => level.isDefaultPickUom) ?? null;
  const upsertUnitProfileMutation = useUpsertProductUnitProfile();
  const replacePackagingLevelsMutation = useReplaceProductPackagingLevels();

  const [isUnitProfileEditing, setIsUnitProfileEditing] = useState(false);
  const [unitProfileDraft, setUnitProfileDraft] = useState(() => createUnitProfileDraft(null));
  const [unitProfileFieldErrors, setUnitProfileFieldErrors] = useState<Partial<Record<UnitProfileNumericField, string>>>({});
  const [unitProfileSaveError, setUnitProfileSaveError] = useState<string | null>(null);

  const [isPackagingEditing, setIsPackagingEditing] = useState(false);
  const [packagingDraft, setPackagingDraft] = useState<PackagingLevelDraft[]>([]);
  const [packagingRowErrors, setPackagingRowErrors] = useState<
    Record<string, Partial<Record<PackagingRowField, string>>>
  >({});
  const [packagingSectionErrors, setPackagingSectionErrors] = useState<string[]>([]);
  const [packagingSaveError, setPackagingSaveError] = useState<string | null>(null);

  const sourcePackagingDraft = useMemo(
    () => (packagingLevelsQuery.data ?? []).map((level, index) => createPackagingLevelDraft(level, index)),
    [packagingLevelsQuery.data]
  );

  const unitProfileDirty = useMemo(() => {
    if (!isUnitProfileEditing) return false;
    const sourceComparable = buildUnitProfileComparable(createUnitProfileDraft(unitProfileQuery.data));
    const draftComparable = buildUnitProfileComparable(unitProfileDraft);

    if (!sourceComparable || !draftComparable) return true;
    return JSON.stringify(sourceComparable) !== JSON.stringify(draftComparable);
  }, [isUnitProfileEditing, unitProfileDraft, unitProfileQuery.data]);

  const packagingDirty = useMemo(() => {
    if (!isPackagingEditing) return false;
    return (
      JSON.stringify(buildPackagingLevelsComparable(sourcePackagingDraft)) !==
      JSON.stringify(buildPackagingLevelsComparable(packagingDraft))
    );
  }, [isPackagingEditing, packagingDraft, sourcePackagingDraft]);

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(returnTo);
  }

  function beginUnitProfileEdit() {
    setUnitProfileDraft(createUnitProfileDraft(unitProfileQuery.data));
    setUnitProfileFieldErrors({});
    setUnitProfileSaveError(null);
    setIsUnitProfileEditing(true);
  }

  function cancelUnitProfileEdit() {
    setIsUnitProfileEditing(false);
    setUnitProfileDraft(createUnitProfileDraft(unitProfileQuery.data));
    setUnitProfileFieldErrors({});
    setUnitProfileSaveError(null);
  }

  async function saveUnitProfile() {
    if (!productId) return;

    const validation = validateUnitProfileDraft(unitProfileDraft);
    if (!validation.payload) {
      setUnitProfileFieldErrors(validation.fieldErrors);
      return;
    }

    setUnitProfileFieldErrors({});
    setUnitProfileSaveError(null);

    try {
      await upsertUnitProfileMutation.mutateAsync({
        productId,
        body: validation.payload
      });
      await unitProfileQuery.refetch();
      setIsUnitProfileEditing(false);
    } catch (error) {
      setUnitProfileSaveError(error instanceof Error ? error.message : 'Failed to save unit profile.');
    }
  }

  function beginPackagingEdit() {
    setPackagingDraft(sourcePackagingDraft);
    setPackagingRowErrors({});
    setPackagingSectionErrors([]);
    setPackagingSaveError(null);
    setIsPackagingEditing(true);
  }

  function cancelPackagingEdit() {
    setIsPackagingEditing(false);
    setPackagingDraft(sourcePackagingDraft);
    setPackagingRowErrors({});
    setPackagingSectionErrors([]);
    setPackagingSaveError(null);
  }

  function updatePackagingRow(draftId: string, patch: Partial<PackagingLevelDraft>) {
    setPackagingDraft((rows) =>
      rows.map((row) =>
        row.draftId === draftId
          ? {
              ...row,
              ...patch
            }
          : row
      )
    );
    setPackagingRowErrors((current) => {
      if (!current[draftId]) return current;
      const next = { ...current };
      delete next[draftId];
      return next;
    });
    setPackagingSectionErrors([]);
    setPackagingSaveError(null);
  }

  function addPackagingRow() {
    const draftId = `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setPackagingDraft((rows) => [...rows, createEmptyPackagingLevelDraft(draftId)]);
    setPackagingSectionErrors([]);
    setPackagingSaveError(null);
  }

  function removePackagingRow(draftId: string) {
    setPackagingDraft((rows) => rows.filter((row) => row.draftId !== draftId));
    setPackagingRowErrors((current) => {
      if (!current[draftId]) return current;
      const next = { ...current };
      delete next[draftId];
      return next;
    });
    setPackagingSectionErrors([]);
    setPackagingSaveError(null);
  }

  async function savePackagingLevels() {
    if (!productId) return;

    const validation = validatePackagingLevelsDraft(packagingDraft);
    if (!validation.payload) {
      setPackagingRowErrors(validation.rowErrors);
      setPackagingSectionErrors(validation.sectionErrors);
      return;
    }

    setPackagingRowErrors({});
    setPackagingSectionErrors([]);
    setPackagingSaveError(null);

    try {
      await replacePackagingLevelsMutation.mutateAsync({
        productId,
        levels: validation.payload
      });
      await packagingLevelsQuery.refetch();
      setIsPackagingEditing(false);
    } catch (error) {
      setPackagingSaveError(error instanceof Error ? error.message : 'Failed to save packaging levels.');
    }
  }

  if (!productId) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-slate-600">Invalid product ID.</p>
          <Link
            to={routes.products}
            className="mt-3 inline-flex rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500"
          >
            Back to Catalog
          </Link>
        </div>
      </div>
    );
  }

  if (productQuery.isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-slate-300" />
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-base font-semibold text-slate-900">Product not found</h1>
          <p className="mt-2 text-sm text-slate-600">
            The requested product does not exist or is no longer available.
          </p>
          <Link
            to={routes.products}
            className="mt-4 inline-flex rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500"
          >
            Back to Catalog
          </Link>
        </div>
      </div>
    );
  }

  if (productQuery.isError || !product) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-base font-semibold text-slate-900">Unable to load product</h1>
          <p className="mt-2 text-sm text-slate-600">
            {productQuery.error instanceof Error
              ? productQuery.error.message
              : 'Unexpected error while loading product detail.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => void productQuery.refetch()}
              className="inline-flex rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Retry
            </button>
            <Link
              to={routes.products}
              className="inline-flex rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500"
            >
              Back to Catalog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="flex h-full w-full flex-1 overflow-hidden">
      <div className="m-4 flex h-full w-full flex-col overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to catalog
              </button>
              <h1 className="mt-2 truncate text-xl font-semibold text-slate-900">{product.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span>{product.sku ?? 'SKU not defined'}</span>
                <span className="text-slate-300">|</span>
                <span>{product.externalProductId}</span>
                <span className="text-slate-300">|</span>
                <span>{product.source}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">
                Status: {product.isActive ? 'active' : 'inactive'}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">
                Profile: {getProfileCompleteness(unitProfileQuery.data)}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">
                Packaging levels: {packagingLevelsQuery.data?.length ?? '-'}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">
                Default pick UOM: {defaultPickLevel?.code ?? 'Not set'}
              </span>
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-4 p-5">
          <section className="rounded-xl border border-slate-200">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Identity</h2>
            </div>
            <dl className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Name</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">{product.name}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">SKU</dt>
                <dd className="mt-1 text-sm text-slate-700">{product.sku ?? 'Not defined'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">External ID</dt>
                <dd className="mt-1 break-all text-sm text-slate-700">{product.externalProductId}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Source</dt>
                <dd className="mt-1 text-sm text-slate-700">{product.source}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Status</dt>
                <dd className="mt-1 text-sm text-slate-700">{product.isActive ? 'Active' : 'Inactive'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Updated</dt>
                <dd className="mt-1 text-sm text-slate-700">
                  {new Date(product.updatedAt).toLocaleString()}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Unit Profile</h2>
              {unitProfileQuery.isLoading || unitProfileQuery.isError ? null : isUnitProfileEditing ? (
                <div className="flex items-center gap-2">
                  {unitProfileDirty ? (
                    <span className="text-xs font-medium text-amber-700">Unsaved changes</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={cancelUnitProfileEdit}
                    disabled={upsertUnitProfileMutation.isPending}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveUnitProfile()}
                    disabled={upsertUnitProfileMutation.isPending}
                    className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {upsertUnitProfileMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={beginUnitProfileEdit}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Edit
                </button>
              )}
            </div>

            {unitProfileQuery.isLoading ? (
              <div className="flex h-24 items-center justify-center p-4">
                <RefreshCw className="h-4 w-4 animate-spin text-slate-300" />
              </div>
            ) : unitProfileQuery.isError ? (
              <div className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm text-red-700">
                <span>
                  {unitProfileQuery.error instanceof Error
                    ? unitProfileQuery.error.message
                    : 'Failed to load unit profile.'}
                </span>
                <button
                  type="button"
                  onClick={() => void unitProfileQuery.refetch()}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Retry
                </button>
              </div>
            ) : isUnitProfileEditing ? (
              <div className="space-y-4 p-4">
                {unitProfileSaveError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {unitProfileSaveError}
                  </div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Exact Measurements
                    </h3>
                    <div className="mt-3 grid gap-2">
                      <label className="grid gap-1 text-sm">
                        <span className="text-slate-500">Weight (g)</span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={unitProfileDraft.unitWeightG}
                          onChange={(event) => {
                            setUnitProfileDraft((current) => ({
                              ...current,
                              unitWeightG: event.target.value
                            }));
                            setUnitProfileFieldErrors((current) => ({
                              ...current,
                              unitWeightG: undefined
                            }));
                            setUnitProfileSaveError(null);
                          }}
                          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                        />
                        {unitProfileFieldErrors.unitWeightG ? (
                          <span className="text-xs text-red-700">{unitProfileFieldErrors.unitWeightG}</span>
                        ) : null}
                      </label>

                      <label className="grid gap-1 text-sm">
                        <span className="text-slate-500">Width (mm)</span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={unitProfileDraft.unitWidthMm}
                          onChange={(event) => {
                            setUnitProfileDraft((current) => ({
                              ...current,
                              unitWidthMm: event.target.value
                            }));
                            setUnitProfileFieldErrors((current) => ({
                              ...current,
                              unitWidthMm: undefined
                            }));
                            setUnitProfileSaveError(null);
                          }}
                          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                        />
                        {unitProfileFieldErrors.unitWidthMm ? (
                          <span className="text-xs text-red-700">{unitProfileFieldErrors.unitWidthMm}</span>
                        ) : null}
                      </label>

                      <label className="grid gap-1 text-sm">
                        <span className="text-slate-500">Height (mm)</span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={unitProfileDraft.unitHeightMm}
                          onChange={(event) => {
                            setUnitProfileDraft((current) => ({
                              ...current,
                              unitHeightMm: event.target.value
                            }));
                            setUnitProfileFieldErrors((current) => ({
                              ...current,
                              unitHeightMm: undefined
                            }));
                            setUnitProfileSaveError(null);
                          }}
                          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                        />
                        {unitProfileFieldErrors.unitHeightMm ? (
                          <span className="text-xs text-red-700">{unitProfileFieldErrors.unitHeightMm}</span>
                        ) : null}
                      </label>

                      <label className="grid gap-1 text-sm">
                        <span className="text-slate-500">Depth (mm)</span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={unitProfileDraft.unitDepthMm}
                          onChange={(event) => {
                            setUnitProfileDraft((current) => ({
                              ...current,
                              unitDepthMm: event.target.value
                            }));
                            setUnitProfileFieldErrors((current) => ({
                              ...current,
                              unitDepthMm: undefined
                            }));
                            setUnitProfileSaveError(null);
                          }}
                          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                        />
                        {unitProfileFieldErrors.unitDepthMm ? (
                          <span className="text-xs text-red-700">{unitProfileFieldErrors.unitDepthMm}</span>
                        ) : null}
                      </label>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Fallback Classes
                    </h3>
                    <div className="mt-3 grid gap-2">
                      <label className="grid gap-1 text-sm">
                        <span className="text-slate-500">Weight class</span>
                        <select
                          value={unitProfileDraft.weightClass}
                          onChange={(event) => {
                            setUnitProfileDraft((current) => ({
                              ...current,
                              weightClass: event.target.value as
                                | ''
                                | 'light'
                                | 'medium'
                                | 'heavy'
                                | 'very_heavy'
                            }));
                            setUnitProfileSaveError(null);
                          }}
                          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                        >
                          <option value="">Not defined</option>
                          <option value="light">Light</option>
                          <option value="medium">Medium</option>
                          <option value="heavy">Heavy</option>
                          <option value="very_heavy">Very heavy</option>
                        </select>
                      </label>

                      <label className="grid gap-1 text-sm">
                        <span className="text-slate-500">Size class</span>
                        <select
                          value={unitProfileDraft.sizeClass}
                          onChange={(event) => {
                            setUnitProfileDraft((current) => ({
                              ...current,
                              sizeClass: event.target.value as
                                | ''
                                | 'small'
                                | 'medium'
                                | 'large'
                                | 'oversized'
                            }));
                            setUnitProfileSaveError(null);
                          }}
                          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                        >
                          <option value="">Not defined</option>
                          <option value="small">Small</option>
                          <option value="medium">Medium</option>
                          <option value="large">Large</option>
                          <option value="oversized">Oversized</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ) : !unitProfileQuery.data ? (
              <div className="p-4 text-sm text-slate-600">Unit profile not defined yet.</div>
            ) : (
              <div className="grid gap-4 p-4 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Exact Measurements
                  </h3>
                  <dl className="mt-3 grid gap-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-slate-500">Weight</dt>
                      <dd className="font-medium text-slate-900">
                        {formatMeasurement(unitProfileQuery.data.unitWeightG, 'g')}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-slate-500">Width</dt>
                      <dd className="font-medium text-slate-900">
                        {formatMeasurement(unitProfileQuery.data.unitWidthMm, 'mm')}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-slate-500">Height</dt>
                      <dd className="font-medium text-slate-900">
                        {formatMeasurement(unitProfileQuery.data.unitHeightMm, 'mm')}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-slate-500">Depth</dt>
                      <dd className="font-medium text-slate-900">
                        {formatMeasurement(unitProfileQuery.data.unitDepthMm, 'mm')}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Fallback Classes
                  </h3>
                  <dl className="mt-3 grid gap-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-slate-500">Weight class</dt>
                      <dd className="font-medium capitalize text-slate-900">
                        {formatClass(unitProfileQuery.data.weightClass)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-slate-500">Size class</dt>
                      <dd className="font-medium capitalize text-slate-900">
                        {formatClass(unitProfileQuery.data.sizeClass)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Packaging Levels</h2>
              {packagingLevelsQuery.isLoading || packagingLevelsQuery.isError ? null : isPackagingEditing ? (
                <div className="flex items-center gap-2">
                  {packagingDirty ? (
                    <span className="text-xs font-medium text-amber-700">Unsaved changes</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={addPackagingRow}
                    disabled={replacePackagingLevelsMutation.isPending}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add row
                  </button>
                  <button
                    type="button"
                    onClick={cancelPackagingEdit}
                    disabled={replacePackagingLevelsMutation.isPending}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void savePackagingLevels()}
                    disabled={replacePackagingLevelsMutation.isPending}
                    className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {replacePackagingLevelsMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={beginPackagingEdit}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
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
                ) : null}

                <div className="overflow-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Code</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Base qty</th>
                        <th className="px-3 py-2">Flags</th>
                        <th className="px-3 py-2">Barcode</th>
                        <th className="px-3 py-2">Pack dims/weight</th>
                        <th className="px-3 py-2">State</th>
                        <th className="px-3 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {packagingDraft.map((row) => {
                        const rowError = packagingRowErrors[row.draftId] ?? {};
                        return (
                          <tr key={row.draftId} className="align-top">
                            <td className="px-3 py-2">
                              <input
                                value={row.code}
                                onChange={(event) =>
                                  updatePackagingRow(row.draftId, {
                                    code: event.target.value
                                  })
                                }
                                className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                              />
                              {rowError.code ? <p className="mt-1 text-xs text-red-700">{rowError.code}</p> : null}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                value={row.name}
                                onChange={(event) =>
                                  updatePackagingRow(row.draftId, {
                                    name: event.target.value
                                  })
                                }
                                className="w-36 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                              />
                              {rowError.name ? <p className="mt-1 text-xs text-red-700">{rowError.name}</p> : null}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min={1}
                                step={1}
                                value={row.baseUnitQty}
                                onChange={(event) =>
                                  updatePackagingRow(row.draftId, {
                                    baseUnitQty: event.target.value
                                  })
                                }
                                className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                              />
                              {rowError.baseUnitQty ? (
                                <p className="mt-1 text-xs text-red-700">{rowError.baseUnitQty}</p>
                              ) : null}
                            </td>
                            <td className="px-3 py-2">
                              <div className="grid gap-1 text-xs text-slate-700">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={row.isBase}
                                    onChange={(event) =>
                                      updatePackagingRow(row.draftId, {
                                        isBase: event.target.checked
                                      })
                                    }
                                  />
                                  Base
                                </label>
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={row.canPick}
                                    onChange={(event) =>
                                      updatePackagingRow(row.draftId, {
                                        canPick: event.target.checked
                                      })
                                    }
                                  />
                                  canPick
                                </label>
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={row.canStore}
                                    onChange={(event) =>
                                      updatePackagingRow(row.draftId, {
                                        canStore: event.target.checked
                                      })
                                    }
                                  />
                                  canStore
                                </label>
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={row.isDefaultPickUom}
                                    onChange={(event) =>
                                      updatePackagingRow(row.draftId, {
                                        isDefaultPickUom: event.target.checked
                                      })
                                    }
                                  />
                                  Default pick
                                </label>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                value={row.barcode}
                                onChange={(event) =>
                                  updatePackagingRow(row.draftId, {
                                    barcode: event.target.value
                                  })
                                }
                                className="w-36 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="grid gap-1">
                                <input
                                  type="number"
                                  min={1}
                                  step={1}
                                  placeholder="Weight g"
                                  value={row.packWeightG}
                                  onChange={(event) =>
                                    updatePackagingRow(row.draftId, {
                                      packWeightG: event.target.value
                                    })
                                  }
                                  className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                                />
                                {rowError.packWeightG ? (
                                  <p className="text-xs text-red-700">{rowError.packWeightG}</p>
                                ) : null}
                                <input
                                  type="number"
                                  min={1}
                                  step={1}
                                  placeholder="Width mm"
                                  value={row.packWidthMm}
                                  onChange={(event) =>
                                    updatePackagingRow(row.draftId, {
                                      packWidthMm: event.target.value
                                    })
                                  }
                                  className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                                />
                                {rowError.packWidthMm ? (
                                  <p className="text-xs text-red-700">{rowError.packWidthMm}</p>
                                ) : null}
                                <input
                                  type="number"
                                  min={1}
                                  step={1}
                                  placeholder="Height mm"
                                  value={row.packHeightMm}
                                  onChange={(event) =>
                                    updatePackagingRow(row.draftId, {
                                      packHeightMm: event.target.value
                                    })
                                  }
                                  className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                                />
                                {rowError.packHeightMm ? (
                                  <p className="text-xs text-red-700">{rowError.packHeightMm}</p>
                                ) : null}
                                <input
                                  type="number"
                                  min={1}
                                  step={1}
                                  placeholder="Depth mm"
                                  value={row.packDepthMm}
                                  onChange={(event) =>
                                    updatePackagingRow(row.draftId, {
                                      packDepthMm: event.target.value
                                    })
                                  }
                                  className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                                />
                                {rowError.packDepthMm ? (
                                  <p className="text-xs text-red-700">{rowError.packDepthMm}</p>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <label className="inline-flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={row.isActive}
                                  onChange={(event) =>
                                    updatePackagingRow(row.draftId, {
                                      isActive: event.target.checked
                                    })
                                  }
                                />
                                Active
                              </label>
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => removePackagingRow(row.draftId)}
                                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : !packagingLevelsQuery.data || packagingLevelsQuery.data.length === 0 ? (
              <div className="p-4 text-sm text-slate-600">Packaging levels not defined yet.</div>
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
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                          {level.barcode ?? 'Not defined'}
                        </td>
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
                              level.isActive
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-200 text-slate-600'
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
        </div>
      </div>
    </section>
  );
}
