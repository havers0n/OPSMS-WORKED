import { z } from 'zod';

export const bondedCoverageRequestStatusSchema = z.enum(['open', 'closed', 'cancelled']);
export type BondedCoverageRequestStatus = z.infer<typeof bondedCoverageRequestStatusSchema>;

const nonNegativeNumber = z.number().finite().min(0);
const positiveNumber = z.number().finite().positive();

export const bondedCoverageRequestSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  shiftId: z.string().uuid(),
  planningDate: z.string(),
  status: bondedCoverageRequestStatusSchema,
  title: z.string().nullable(),
  notes: z.string().nullable(),
  bondedSnapshotId: z.string().uuid().nullable(),
  warehouseStockSnapshotId: z.string().uuid().nullable(),
  createdByProfileId: z.string().uuid().nullable(),
  createdByName: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  closedByProfileId: z.string().uuid().nullable(),
  closedByName: z.string().nullable(),
  closedAt: z.string().nullable(),
  cancelledByProfileId: z.string().uuid().nullable(),
  cancelledByName: z.string().nullable(),
  cancelledAt: z.string().nullable()
});
export type BondedCoverageRequest = z.infer<typeof bondedCoverageRequestSchema>;

export const bondedCoverageRequestItemSchema = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid(),
  sku: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  requestedQty: positiveNumber,
  fulfilledQty: nonNegativeNumber,
  demandQtyAtCreate: z.number().nullable(),
  warehouseQtyAtCreate: z.number().nullable(),
  shortageQtyAtCreate: z.number().nullable(),
  bondedAvailableQtyAtCreate: z.number().nullable(),
  bondedCoverQtyAtCreate: z.number().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type BondedCoverageRequestItem = z.infer<typeof bondedCoverageRequestItemSchema>;

export const bondedCoverageRequestDetailSchema = bondedCoverageRequestSchema.extend({
  items: z.array(bondedCoverageRequestItemSchema)
});
export type BondedCoverageRequestDetail = z.infer<typeof bondedCoverageRequestDetailSchema>;

export const createBondedCoverageRequestInputItemSchema = z.object({
  sku: z.string().min(1),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  requestedQty: positiveNumber,
  demandQtyAtCreate: nonNegativeNumber.nullable().optional(),
  warehouseQtyAtCreate: nonNegativeNumber.nullable().optional(),
  shortageQtyAtCreate: nonNegativeNumber.nullable().optional(),
  bondedAvailableQtyAtCreate: nonNegativeNumber.nullable().optional(),
  bondedCoverQtyAtCreate: nonNegativeNumber.nullable().optional(),
  notes: z.string().nullable().optional()
});
export type CreateBondedCoverageRequestInputItem = z.infer<typeof createBondedCoverageRequestInputItemSchema>;

export const createBondedCoverageRequestInputSchema = z.object({
  planningDate: z.string(),
  title: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  bondedSnapshotId: z.string().uuid().nullable().optional(),
  warehouseStockSnapshotId: z.string().uuid().nullable().optional(),
  items: z.array(createBondedCoverageRequestInputItemSchema).max(100).optional()
});
export type CreateBondedCoverageRequestInput = z.infer<typeof createBondedCoverageRequestInputSchema>;

export const addBondedCoverageRequestItemInputSchema = z.object({
  sku: z.string().min(1),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  requestedQty: positiveNumber,
  demandQtyAtCreate: nonNegativeNumber.nullable().optional(),
  warehouseQtyAtCreate: nonNegativeNumber.nullable().optional(),
  shortageQtyAtCreate: nonNegativeNumber.nullable().optional(),
  bondedAvailableQtyAtCreate: nonNegativeNumber.nullable().optional(),
  bondedCoverQtyAtCreate: nonNegativeNumber.nullable().optional(),
  notes: z.string().nullable().optional()
});
export type AddBondedCoverageRequestItemInput = z.infer<typeof addBondedCoverageRequestItemInputSchema>;

export const updateBondedCoverageRequestItemInputSchema = z.object({
  requestedQty: positiveNumber.optional(),
  notes: z.string().nullable().optional()
});
export type UpdateBondedCoverageRequestItemInput = z.infer<typeof updateBondedCoverageRequestItemInputSchema>;

export const closeBondedCoverageRequestInputItemSchema = z.object({
  itemId: z.string().uuid(),
  fulfilledQty: nonNegativeNumber
});

export const closeBondedCoverageRequestInputSchema = z.object({
  notes: z.string().nullable().optional(),
  items: z.array(closeBondedCoverageRequestInputItemSchema).optional()
});
export type CloseBondedCoverageRequestInput = z.infer<typeof closeBondedCoverageRequestInputSchema>;

export const cancelBondedCoverageRequestInputSchema = z.object({
  notes: z.string().nullable().optional()
});
export type CancelBondedCoverageRequestInput = z.infer<typeof cancelBondedCoverageRequestInputSchema>;

export const listBondedCoverageRequestsInputSchema = z.object({
  status: bondedCoverageRequestStatusSchema.optional()
});
export type ListBondedCoverageRequestsInput = z.infer<typeof listBondedCoverageRequestsInputSchema>;
