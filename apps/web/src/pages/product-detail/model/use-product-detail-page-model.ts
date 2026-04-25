import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ProductUnitProfile } from '@wos/domain';
import { containerTypesQueryOptions } from '@/entities/container/api/queries';
import {
  useCreateProductStoragePreset,
  useReplaceProductPackagingLevels,
  useUpsertProductUnitProfile
} from '@/entities/product/api/mutations';
import {
  productPackagingLevelsQueryOptions,
  productQueryOptions,
  productStoragePresetsQueryOptions,
  productUnitProfileQueryOptions
} from '@/entities/product/api/queries';
import { resolveProductDisplayImages } from '@/entities/product/lib/display';
import { BffRequestError } from '@/shared/api/bff/client';
import {
  equalPackagingLevelsComparable,
  equalUnitProfileComparable
} from './comparators';
import { derivePackagingEditorSemantics } from '../ui/packaging-editor-semantics';
import {
  buildPackagingLevelsComparable,
  buildUnitProfileComparable,
  createEmptyPackagingLevelDraft,
  createPackagingLevelDraft,
  createUnitProfileDraft,
  type PackagingLevelDraft,
  type PackagingRowField,
  type UnitProfileDraft,
  type UnitProfileNumericField,
  validatePackagingLevelsDraft,
  validateUnitProfileDraft
} from '../ui/section-editing';

function getNextCircularIndex(current: number, delta: number, length: number) {
  if (length <= 0) return 0;
  return (current + delta + length) % length;
}

export type ProductDetailPageModel = ReturnType<typeof useProductDetailPageModel>;

export function getProfileCompleteness(profile: ProductUnitProfile | null | undefined) {
  if (!profile) return 'Missing';
  const hasExact =
    profile.unitWeightG !== null &&
    profile.unitWidthMm !== null &&
    profile.unitHeightMm !== null &&
    profile.unitDepthMm !== null;
  return hasExact ? 'Complete' : 'Partial';
}

export function useProductDetailPageModel(productId: string | null) {
  const productQuery = useQuery(productQueryOptions(productId));
  const product = productQuery.data ?? null;

  const sectionQueriesEnabled = Boolean(productId) && Boolean(product);

  const unitProfileQuery = useQuery({
    ...productUnitProfileQueryOptions(productId),
    enabled: sectionQueriesEnabled
  });

  const packagingLevelsQuery = useQuery({
    ...productPackagingLevelsQueryOptions(productId),
    enabled: sectionQueriesEnabled
  });

  const storagePresetsQuery = useQuery({
    ...productStoragePresetsQueryOptions(productId),
    enabled: sectionQueriesEnabled
  });

  const containerTypesQuery = useQuery({
    ...containerTypesQueryOptions(),
    enabled: sectionQueriesEnabled
  });

  const productError = productQuery.error;
  const isNotFound = productError instanceof BffRequestError && productError.status === 404;

  const defaultPickLevel = packagingLevelsQuery.data?.find((level) => level.isDefaultPickUom) ?? null;
  const upsertUnitProfileMutation = useUpsertProductUnitProfile();
  const replacePackagingLevelsMutation = useReplaceProductPackagingLevels();
  const createStoragePresetMutation = useCreateProductStoragePreset();

  const [isUnitProfileEditing, setIsUnitProfileEditing] = useState(false);
  const [unitProfileDraft, setUnitProfileDraft] = useState<UnitProfileDraft>(() => createUnitProfileDraft(null));
  const [unitProfileFieldErrors, setUnitProfileFieldErrors] = useState<
    Partial<Record<UnitProfileNumericField, string>>
  >({});
  const [unitProfileSaveError, setUnitProfileSaveError] = useState<string | null>(null);

  const [isPackagingEditing, setIsPackagingEditing] = useState(false);
  const [packagingDraft, setPackagingDraft] = useState<PackagingLevelDraft[]>([]);
  const [packagingRowErrors, setPackagingRowErrors] = useState<
    Record<string, Partial<Record<PackagingRowField, string>>>
  >({});
  const [packagingSectionErrors, setPackagingSectionErrors] = useState<string[]>([]);
  const [packagingSaveError, setPackagingSaveError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [brokenImageUrls, setBrokenImageUrls] = useState<Record<string, true>>({});

  const sourcePackagingDraft = useMemo(
    () => (packagingLevelsQuery.data ?? []).map((level, index) => createPackagingLevelDraft(level, index)),
    [packagingLevelsQuery.data]
  );
  const packagingEditorSemantics = useMemo(
    () => derivePackagingEditorSemantics(packagingDraft),
    [packagingDraft]
  );
  const resolvedDisplayImages = useMemo(() => resolveProductDisplayImages(product), [product]);
  const displayImages = useMemo(
    () => resolvedDisplayImages.filter((source) => !brokenImageUrls[source]),
    [brokenImageUrls, resolvedDisplayImages]
  );
  const activeImageIndex =
    displayImages.length === 0 ? 0 : Math.min(selectedImageIndex, displayImages.length - 1);
  const selectedImageUrl = displayImages[activeImageIndex] ?? null;

  const unitProfileDirty = useMemo(() => {
    if (!isUnitProfileEditing) return false;
    const sourceComparable = buildUnitProfileComparable(createUnitProfileDraft(unitProfileQuery.data));
    const draftComparable = buildUnitProfileComparable(unitProfileDraft);

    if (!sourceComparable || !draftComparable) return true;
    return !equalUnitProfileComparable(sourceComparable, draftComparable);
  }, [isUnitProfileEditing, unitProfileDraft, unitProfileQuery.data]);

  const packagingDirty = useMemo(() => {
    if (!isPackagingEditing) return false;
    return !equalPackagingLevelsComparable(
      buildPackagingLevelsComparable(sourcePackagingDraft),
      buildPackagingLevelsComparable(packagingDraft)
    );
  }, [isPackagingEditing, packagingDraft, sourcePackagingDraft]);

  useEffect(() => {
    setBrokenImageUrls({});
    setSelectedImageIndex(0);
    setLightboxOpen(false);
  }, [product?.id]);

  useEffect(() => {
    if (displayImages.length === 0) {
      if (selectedImageIndex !== 0) {
        setSelectedImageIndex(0);
      }
      if (lightboxOpen) {
        setLightboxOpen(false);
      }
      return;
    }

    if (selectedImageIndex >= displayImages.length) {
      setSelectedImageIndex(0);
    }
  }, [displayImages.length, lightboxOpen, selectedImageIndex]);

  useEffect(() => {
    if (!lightboxOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setLightboxOpen(false);
        return;
      }

      if (displayImages.length <= 1) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setSelectedImageIndex((current) => getNextCircularIndex(current, -1, displayImages.length));
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setSelectedImageIndex((current) => getNextCircularIndex(current, 1, displayImages.length));
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [displayImages.length, lightboxOpen]);

  function handleImageLoadError(source: string) {
    setBrokenImageUrls((current) => {
      if (current[source]) return current;
      return {
        ...current,
        [source]: true
      };
    });
  }

  function selectImage(index: number) {
    setSelectedImageIndex(index);
  }

  function openLightbox() {
    if (!selectedImageUrl) return;
    setLightboxOpen(true);
  }

  function closeLightbox() {
    setLightboxOpen(false);
  }

  function goToNextImage() {
    if (displayImages.length <= 1) return;
    setSelectedImageIndex((current) => getNextCircularIndex(current, 1, displayImages.length));
  }

  function goToPreviousImage() {
    if (displayImages.length <= 1) return;
    setSelectedImageIndex((current) => getNextCircularIndex(current, -1, displayImages.length));
  }

  function updateUnitProfileDraftField(field: UnitProfileNumericField, value: string) {
    setUnitProfileDraft((current) => ({
      ...current,
      [field]: value
    }));
    setUnitProfileFieldErrors((current) => ({
      ...current,
      [field]: undefined
    }));
    setUnitProfileSaveError(null);
  }

  function updateUnitProfileDraftClassField(
    field: 'weightClass' | 'sizeClass',
    value: UnitProfileDraft[typeof field]
  ) {
    setUnitProfileDraft((current) => ({
      ...current,
      [field]: value
    }));
    setUnitProfileSaveError(null);
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
    if (!productId) return false;

    const validation = validateUnitProfileDraft(unitProfileDraft);
    if (!validation.payload) {
      setUnitProfileFieldErrors(validation.fieldErrors);
      return false;
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
      return true;
    } catch (error) {
      setUnitProfileSaveError(error instanceof Error ? error.message : 'Failed to save unit profile.');
      return false;
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
    const normalizedPatch =
      patch.isBase === true
        ? {
            ...patch,
            baseUnitQty: '1'
          }
        : patch;

    setPackagingDraft((rows) =>
      rows.map((row) =>
        row.draftId === draftId
          ? {
              ...row,
              ...normalizedPatch
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
    if (!productId) return false;

    const validation = validatePackagingLevelsDraft(packagingDraft);
    if (!validation.payload) {
      setPackagingRowErrors(validation.rowErrors);
      setPackagingSectionErrors(validation.sectionErrors);
      return false;
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
      return true;
    } catch (error) {
      setPackagingSaveError(error instanceof Error ? error.message : 'Failed to save packaging levels.');
      return false;
    }
  }

  return {
    productQuery,
    product,
    unitProfileQuery,
    packagingLevelsQuery,
    storagePresetsQuery,
    containerTypesQuery,
    isNotFound,
    defaultPickLevel,
    upsertUnitProfileMutation,
    replacePackagingLevelsMutation,
    createStoragePresetMutation,
    isUnitProfileEditing,
    unitProfileDraft,
    unitProfileFieldErrors,
    unitProfileSaveError,
    unitProfileDirty,
    isPackagingEditing,
    packagingDraft,
    packagingRowErrors,
    packagingSectionErrors,
    packagingSaveError,
    packagingDirty,
    packagingEditorSemantics,
    displayImages,
    activeImageIndex,
    selectedImageUrl,
    lightboxOpen,
    handleImageLoadError,
    selectImage,
    openLightbox,
    closeLightbox,
    goToNextImage,
    goToPreviousImage,
    updateUnitProfileDraftField,
    updateUnitProfileDraftClassField,
    beginUnitProfileEdit,
    cancelUnitProfileEdit,
    saveUnitProfile,
    beginPackagingEdit,
    cancelPackagingEdit,
    updatePackagingRow,
    addPackagingRow,
    removePackagingRow,
    savePackagingLevels
  };
}
