import { z } from 'zod';
import {
  rackAxisSchema,
  rackFaceSideSchema,
  rackKindSchema,
  slotNumberingDirectionSchema
} from '../enums/layout';

export const rackLevelSchema = z.object({
  id: z.string(),
  ordinal: z.number().int().min(1),
  slotCount: z.number().int().min(1)
});
export type RackLevel = z.infer<typeof rackLevelSchema>;

export const rackSectionSchema = z.object({
  id: z.string(),
  ordinal: z.number().int().min(1),
  length: z.number().positive(),
  levels: z.array(rackLevelSchema)
});
export type RackSection = z.infer<typeof rackSectionSchema>;

export const rackFaceSchema = z.object({
  id: z.string(),
  side: rackFaceSideSchema,
  enabled: z.boolean(),
  slotNumberingDirection: slotNumberingDirectionSchema,
  isMirrored: z.boolean(),
  mirrorSourceFaceId: z.string().nullable(),
  /**
   * Per-face override length (metres). When set, this face's sections must sum
   * to this value instead of rack.totalLength. Used in paired racks where
   * Face A and Face B can have different physical lengths.
   */
  faceLength: z.number().positive().optional(),
  sections: z.array(rackSectionSchema)
});
export type RackFace = z.infer<typeof rackFaceSchema>;

export const rackSchema = z.object({
  id: z.string(),
  displayCode: z.string(),
  kind: rackKindSchema,
  axis: rackAxisSchema,
  x: z.number(),
  y: z.number(),
  totalLength: z.number().positive(),
  depth: z.number().positive(),
  rotationDeg: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  faces: z.array(rackFaceSchema)
});
export type Rack = z.infer<typeof rackSchema>;
