import { z } from 'zod';
import { PICKING_METHODS } from '@wos/domain';

const finiteNumber = z.number().finite();
const positiveFiniteNumber = finiteNumber.positive();

const orderRefSchema = z.object({
  orderId: z.string().trim().min(1),
  orderLineId: z.string().trim().min(1),
  qty: positiveFiniteNumber
});

const taskSchema = z.object({
  id: z.string().trim().min(1),
  skuId: z.string().trim().min(1),
  fromLocationId: z.string().trim().min(1),
  qty: positiveFiniteNumber,
  orderRefs: z.array(orderRefSchema),
  weightKg: finiteNumber.optional(),
  volumeLiters: finiteNumber.optional(),
  handlingClass: z.enum(['normal', 'heavy', 'bulky', 'fragile', 'cold', 'frozen', 'hazmat']).optional()
});

const locationRefSchema = z.object({
  id: z.string().trim().min(1),
  addressLabel: z.string().trim().min(1).optional(),
  zoneId: z.string().trim().min(1).optional(),
  pickZoneId: z.string().trim().min(1).optional(),
  taskZoneId: z.string().trim().min(1).optional(),
  allocationZoneId: z.string().trim().min(1).optional(),
  routeSequence: finiteNumber.optional(),
  pickSequence: finiteNumber.optional(),
  accessAisleId: z.string().trim().min(1).optional(),
  sideOfAisle: z.enum(['left', 'right']).optional(),
  positionAlongAisle: finiteNumber.optional(),
  travelNodeId: z.string().trim().min(1).optional(),
  x: finiteNumber.optional(),
  y: finiteNumber.optional()
});

const pickingPlanningPreviewBaseSchema = z.object({
  strategyMethod: z.enum(PICKING_METHODS as [typeof PICKING_METHODS[number], ...typeof PICKING_METHODS[number][]]).optional(),
  routeMode: z.enum(['location_sequence', 'address_sequence', 'distance', 'handling', 'hybrid']).optional(),
  assignedPickerId: z.string().trim().min(1).optional(),
  assignedZoneId: z.string().trim().min(1).optional(),
  assignedCartId: z.string().trim().min(1).optional(),
  id: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
});



export const pickingPlanningPreviewRequestSchema = pickingPlanningPreviewBaseSchema.extend({
  tasks: z.array(taskSchema),
  locationsById: z.record(z.string().trim().min(1), locationRefSchema).optional()
});

export const pickingPlanningPreviewOrdersRequestSchema = pickingPlanningPreviewBaseSchema.extend({
  orderIds: z.array(z.string().trim().min(1)).min(1)
});

export type PickingPlanningPreviewRequest = z.infer<typeof pickingPlanningPreviewRequestSchema>;
export type PickingPlanningPreviewOrdersRequest = z.infer<typeof pickingPlanningPreviewOrdersRequestSchema>;
