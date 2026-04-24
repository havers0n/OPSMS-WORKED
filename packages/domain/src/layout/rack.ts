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
  slotCount: z.number().int().min(1),
  structuralDefaultRole: z.enum(['primary_pick', 'reserve', 'none']).optional()
});
export type RackLevel = z.infer<typeof rackLevelSchema>;

export const rackSectionSchema = z.object({
  id: z.string(),
  ordinal: z.number().int().min(1),
  length: z.number().positive(),
  levels: z.array(rackLevelSchema)
});
export type RackSection = z.infer<typeof rackSectionSchema>;

export const rackFaceRelationshipModeSchema = z.enum(['mirrored', 'independent']);
export type RackFaceRelationshipMode = z.infer<typeof rackFaceRelationshipModeSchema>;

export const rackFaceSchema = z.object({
  id: z.string(),
  side: rackFaceSideSchema,
  enabled: z.boolean(),
  slotNumberingDirection: slotNumberingDirectionSchema,
  /**
   * Temporary compatibility bridge for legacy drafts that still persist only
   * mirror fields. Canonical runtime writes must materialize this field.
   */
  relationshipMode: rackFaceRelationshipModeSchema.optional(),
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

export function resolveRackFaceRelationshipMode(face: RackFace): RackFaceRelationshipMode {
  return face.relationshipMode ?? (face.isMirrored ? 'mirrored' : 'independent');
}

export function isRackFaceMirrored(face: RackFace): boolean {
  return resolveRackFaceRelationshipMode(face) === 'mirrored';
}

export function resolveRackFaceSections(face: RackFace, rack: Rack): RackSection[] {
  if (!isRackFaceMirrored(face) || !face.mirrorSourceFaceId) {
    return face.sections;
  }

  const sourceFace = rack.faces.find((candidate) => candidate.id === face.mirrorSourceFaceId);
  return sourceFace?.sections ?? face.sections;
}

export function synchronizeRackFaceRelationship(face: RackFace): RackFace {
  const relationshipMode = resolveRackFaceRelationshipMode(face);
  return {
    ...face,
    relationshipMode,
    isMirrored: relationshipMode === 'mirrored',
    mirrorSourceFaceId: relationshipMode === 'mirrored' ? face.mirrorSourceFaceId : null
  };
}

export const rackGeometrySchema = z.object({
  x: z.number(),
  y: z.number(),
  totalLength: z.number().positive(),
  depth: z.number().positive(),
  rotationDeg: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])
});
export type RackGeometry = z.infer<typeof rackGeometrySchema>;

export const rackStructureSchema = z.object({
  displayCode: z.string(),
  kind: rackKindSchema,
  axis: rackAxisSchema,
  faces: z.array(rackFaceSchema)
});
export type RackStructure = z.infer<typeof rackStructureSchema>;

export const rackSchema = z.object({
  id: z.string(),
  ...rackStructureSchema.shape,
  ...rackGeometrySchema.shape
});
export type Rack = z.infer<typeof rackSchema>;

export function splitRack(rack: Rack) {
  return {
    id: rack.id,
    geometry: rackGeometrySchema.parse({
      x: rack.x,
      y: rack.y,
      totalLength: rack.totalLength,
      depth: rack.depth,
      rotationDeg: rack.rotationDeg
    }),
    structure: rackStructureSchema.parse({
      displayCode: rack.displayCode,
      kind: rack.kind,
      axis: rack.axis,
      faces: rack.faces
    })
  };
}

export function composeRack(input: { id: string; geometry: RackGeometry; structure: RackStructure }): Rack {
  return rackSchema.parse({
    id: input.id,
    ...input.structure,
    ...input.geometry
  });
}
