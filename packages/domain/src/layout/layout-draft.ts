import { z } from 'zod';
import { layoutVersionStateSchema } from '../enums/layout';
import { composeRack, rackSchema, splitRack } from './rack';
import { wallSchema, type Wall } from './wall';
import { zoneSchema, type Zone } from './zone';

export const layoutLifecycleInfoSchema = z.object({
  layoutVersionId: z.string(),
  draftVersion: z.number().int().min(0).optional().nullable(),
  floorId: z.string(),
  state: layoutVersionStateSchema,
  versionNo: z.number().int().min(1).optional().nullable()
});
export type LayoutLifecycleInfo = z.infer<typeof layoutLifecycleInfoSchema>;

export const layoutDraftSchema = z.object({
  ...layoutLifecycleInfoSchema.shape,
  rackIds: z.array(z.string()),
  racks: z.record(z.string(), rackSchema),
  zoneIds: z.array(z.string()).default([]),
  zones: z.record(z.string(), zoneSchema).default({}),
  wallIds: z.array(z.string()).default([]),
  walls: z.record(z.string(), wallSchema).default({})
});
export type LayoutDraft = z.infer<typeof layoutDraftSchema>;

export function splitLayoutDraft(layoutDraft: LayoutDraft) {
  return {
    lifecycle: layoutLifecycleInfoSchema.parse({
      layoutVersionId: layoutDraft.layoutVersionId,
      draftVersion: layoutDraft.draftVersion ?? null,
      floorId: layoutDraft.floorId,
      state: layoutDraft.state,
      versionNo: layoutDraft.versionNo ?? null
    }),
    racks: layoutDraft.rackIds.map((rackId) => splitRack(layoutDraft.racks[rackId])),
    zones: layoutDraft.zoneIds.map((zoneId) => layoutDraft.zones[zoneId]),
    walls: layoutDraft.wallIds.map((wallId) => layoutDraft.walls[wallId])
  };
}

export function composeLayoutDraft(input: {
  lifecycle: LayoutLifecycleInfo;
  racks: Array<ReturnType<typeof splitRack>>;
  zones?: Zone[];
  walls?: Wall[];
}): LayoutDraft {
  const racks = input.racks.map((rack) => composeRack(rack));
  const zones = input.zones ?? [];
  const walls = input.walls ?? [];

  return layoutDraftSchema.parse({
    ...input.lifecycle,
    rackIds: racks.map((rack) => rack.id),
    racks: Object.fromEntries(racks.map((rack) => [rack.id, rack])),
    zoneIds: zones.map((zone) => zone.id),
    zones: Object.fromEntries(zones.map((zone) => [zone.id, zone])),
    wallIds: walls.map((wall) => wall.id),
    walls: Object.fromEntries(walls.map((wall) => [wall.id, wall]))
  });
}
