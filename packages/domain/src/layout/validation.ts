import { z } from 'zod';

export const layoutValidationIssueSeveritySchema = z.enum(['error', 'warning']);
export type LayoutValidationIssueSeverity = z.infer<typeof layoutValidationIssueSeveritySchema>;

export const layoutValidationIssueSchema = z.object({
  code: z.string(),
  severity: layoutValidationIssueSeveritySchema,
  message: z.string(),
  entityId: z.string().optional()
});
export type LayoutValidationIssue = z.infer<typeof layoutValidationIssueSchema>;

export const layoutValidationResultSchema = z.object({
  isValid: z.boolean(),
  issues: z.array(layoutValidationIssueSchema)
});
export type LayoutValidationResult = z.infer<typeof layoutValidationResultSchema>;

export const layoutPublishResultSchema = z.object({
  layoutVersionId: z.string(),
  publishedAt: z.string(),
  generatedCells: z.number().int(),
  validation: layoutValidationResultSchema
});
export type LayoutPublishResult = z.infer<typeof layoutPublishResultSchema>;

export type LayoutPublishImpact = {
  createdCells: number;
  removedCells: number;
  changedAddresses: number;
  requiresReview: boolean;
};
