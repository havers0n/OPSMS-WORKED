export const layoutValidationKeys = {
  all: ['layout-validation'] as const,
  byLayoutVersion: (layoutVersionId: string | null) =>
    [...layoutValidationKeys.all, layoutVersionId ?? 'none'] as const
};
