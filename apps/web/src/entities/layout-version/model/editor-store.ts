import type { LayoutDraft, Rack, RackFace, RackKind, SlotNumberingDirection } from '@wos/domain';
import { create } from 'zustand';
import type { EditorMode, EditorSelection, ViewMode } from './editor-types';
import {
  checkMinimumDistance,
  alignRacksToLine,
  distributeRacksEqually,
  getRackBoundingBox
} from '../../../widgets/warehouse-editor/lib/rack-spacing';

type EditorStore = {
  viewMode: ViewMode;
  editorMode: EditorMode;
  /** Canonical selection state. Use setSelection / clearSelection to mutate. */
  selection: EditorSelection;
  hoveredRackId: string | null;
  /** ID of the rack currently going through the creation wizard. Cleared on wizard finish/cancel. */
  creatingRackId: string | null;
  zoom: number;
  minRackDistance: number;
  draft: LayoutDraft | null;
  draftSourceVersionId: string | null;
  isDraftDirty: boolean;
  setViewMode: (mode: ViewMode) => void;
  setEditorMode: (mode: EditorMode) => void;
  setSelection: (selection: EditorSelection) => void;
  clearSelection: () => void;
  /** Convenience wrapper — sets a rack-type selection from an id array. */
  setSelectedRackIds: (rackIds: string[]) => void;
  /** Convenience wrapper — sets a single-rack selection, or clears if null. */
  setSelectedRackId: (rackId: string | null) => void;
  toggleRackSelection: (rackId: string) => void;
  /** Convenience wrapper — sets a cell-type selection, or clears if null. */
  setSelectedCellId: (cellId: string | null) => void;
  /** Convenience wrapper — sets a container-type selection, or clears if null. */
  setSelectedContainerId: (containerId: string | null) => void;
  setHoveredRackId: (rackId: string | null) => void;
  setCreatingRackId: (rackId: string | null) => void;
  setZoom: (zoom: number) => void;
  setMinRackDistance: (distance: number) => void;
  resetDraft: () => void;
  initializeDraft: (draft: LayoutDraft) => void;
  markDraftSaved: (layoutVersionId: string) => void;
  createRack: (x: number, y: number) => void;
  deleteRack: (rackId: string) => void;
  duplicateRack: (rackId: string) => void;
  updateRackPosition: (rackId: string, x: number, y: number) => void;
  rotateRack: (rackId: string) => void;
  updateRackGeneral: (rackId: string, patch: Partial<Pick<Rack, 'displayCode' | 'kind' | 'axis' | 'totalLength' | 'depth'>>) => void;
  updateFaceConfig: (rackId: string, side: 'A' | 'B', patch: Partial<Pick<RackFace, 'slotNumberingDirection' | 'enabled'>>) => void;
  updateSectionLength: (rackId: string, side: 'A' | 'B', sectionId: string, length: number) => void;
  updateSectionSlots: (rackId: string, side: 'A' | 'B', sectionId: string, slotCount: number) => void;
  updateLevelCount: (rackId: string, side: 'A' | 'B', sectionId: string, count: number) => void;
  addSection: (rackId: string, side: 'A' | 'B') => void;
  deleteSection: (rackId: string, side: 'A' | 'B', sectionId: string) => void;
  addLevel: (rackId: string, side: 'A' | 'B', sectionId: string) => void;
  setFaceBMode: (rackId: string, mode: 'mirror' | 'copy' | 'scratch') => void;
  resetFaceB: (rackId: string) => void;
  /** Replace all sections in a face with N equal-length sections generated from preset values. */
  applyFacePreset: (rackId: string, side: 'A' | 'B', sectionCount: number, levelCount: number, slotCount: number) => void;
  /** Set an independent physical length for one face (paired racks with asymmetric face lengths). */
  setFaceLength: (rackId: string, side: 'A' | 'B', length: number) => void;
  alignRacksHorizontal: (rackIds: string[]) => void;
  alignRacksVertical: (rackIds: string[]) => void;
  distributeRacksEqual: (rackIds: string[], axis: 'x' | 'y') => void;
};

const initialEditorState = {
  viewMode: 'layout' as ViewMode,
  editorMode: 'select' as EditorMode,
  selection: { type: 'none' } as EditorSelection,
  hoveredRackId: null,
  creatingRackId: null,
  zoom: 1,
  minRackDistance: 0,
  draft: null,
  draftSourceVersionId: null,
  isDraftDirty: false
};

// ── Selection helpers ──────────────────────────────────────────────────────────

function makeRackSelection(ids: string[]): EditorSelection {
  return ids.length > 0 ? { type: 'rack', rackIds: ids } : { type: 'none' };
}

function getSelectedRackIds(selection: EditorSelection): string[] {
  return selection.type === 'rack' ? selection.rackIds : [];
}

function cloneDraft(draft: LayoutDraft): LayoutDraft {
  return structuredClone(draft);
}

function canEditDraft(draft: LayoutDraft | null): draft is LayoutDraft {
  return Boolean(draft && draft.state === 'draft');
}

function updateRackInDraft(draft: LayoutDraft, rackId: string, updater: (rack: Rack) => Rack): LayoutDraft {
  const nextDraft = cloneDraft(draft);
  const rack = nextDraft.racks[rackId];
  nextDraft.racks[rackId] = updater(rack);
  return nextDraft;
}

function nextSectionOrdinal(face: RackFace) {
  return face.sections.length === 0 ? 1 : Math.max(...face.sections.map((section) => section.ordinal)) + 1;
}

function nextLevelOrdinal(section: RackFace['sections'][number]) {
  return section.levels.length === 0 ? 1 : Math.max(...section.levels.map((level) => level.ordinal)) + 1;
}

function newEntityId() {
  return crypto.randomUUID();
}

function roundLength(length: number) {
  return Math.round(length * 1000) / 1000;
}

function lengthsMatch(left: number, right: number) {
  return Math.abs(left - right) < 0.001;
}

function buildEmptySection(side: 'A' | 'B', ordinal: number, slotCount = 3, length = 2.5) {
  return {
    id: newEntityId(),
    ordinal,
    length,
    levels: [{ id: newEntityId(), ordinal: 1, slotCount }]
  };
}

function scaleSectionsToLength(sections: RackFace['sections'], targetLength: number) {
  if (sections.length === 0) {
    return sections;
  }

  if (sections.length === 1) {
    return lengthsMatch(sections[0].length, targetLength)
      ? sections
      : [{ ...sections[0], length: roundLength(targetLength) }];
  }

  const currentSum = sections.reduce((sum, section) => sum + section.length, 0);
  if (currentSum <= 0 || lengthsMatch(currentSum, targetLength)) {
    return sections;
  }

  const nextSections = sections.map((section) => ({ ...section }));
  let assigned = 0;

  for (let index = 0; index < nextSections.length; index += 1) {
    if (index === nextSections.length - 1) {
      nextSections[index].length = roundLength(targetLength - assigned);
      continue;
    }

    const scaled = roundLength((sections[index].length / currentSum) * targetLength);
    nextSections[index].length = scaled;
    assigned += scaled;
  }

  return nextSections;
}

function normalizeRack(rack: Rack): Rack {
  return {
    ...rack,
    faces: rack.faces.map((face) => {
      if (rack.kind === 'single' && face.side === 'B') {
        return {
          ...face,
          enabled: false,
          isMirrored: false,
          mirrorSourceFaceId: null,
          faceLength: undefined,
          sections: []
        };
      }

      if (face.side === 'B' && face.isMirrored) {
        return {
          ...face,
          enabled: true,
          faceLength: undefined,
          sections: []
        };
      }

      if (face.sections.length === 0) {
        return face;
      }

      const expectedLength = face.faceLength ?? rack.totalLength;
      const nextSections = scaleSectionsToLength(face.sections, expectedLength);
      return nextSections === face.sections ? face : { ...face, sections: nextSections };
    })
  };
}

function normalizeDraft(draft: LayoutDraft) {
  let changed = false;
  const nextDraft = cloneDraft(draft);

  for (const rackId of nextDraft.rackIds) {
    const normalizedRack = normalizeRack(nextDraft.racks[rackId]);
    if (JSON.stringify(normalizedRack) !== JSON.stringify(nextDraft.racks[rackId])) {
      nextDraft.racks[rackId] = normalizedRack;
      changed = true;
    }
  }

  return { draft: nextDraft, changed };
}

function nextRackDisplayCode(racks: Record<string, Rack>): string {
  const numerics = Object.values(racks)
    .map((r) => parseInt(r.displayCode, 10))
    .filter((n) => !isNaN(n));
  const max = numerics.length > 0 ? Math.max(...numerics) : 0;
  return String(max + 1).padStart(2, '0');
}

function buildNewRack(racks: Record<string, Rack>, x: number, y: number): Rack {
  const rackId = newEntityId();
  const faceAId = newEntityId();
  const faceBId = newEntityId();
  const displayCode = nextRackDisplayCode(racks);
  const totalLength = 5;

  return {
    id: rackId,
    displayCode,
    kind: 'single',
    axis: 'NS',
    x,
    y,
    totalLength,
    depth: 1.2,
    rotationDeg: 0,
    faces: [
      {
        id: faceAId,
        side: 'A',
        enabled: true,
        slotNumberingDirection: 'ltr',
        isMirrored: false,
        mirrorSourceFaceId: null,
        sections: [buildEmptySection('A', 1, 3, totalLength)]
      },
      {
        id: faceBId,
        side: 'B',
        enabled: false,
        slotNumberingDirection: 'ltr',
        isMirrored: false,
        mirrorSourceFaceId: null,
        sections: []
      }
    ]
  };
}

export const useEditorStore = create<EditorStore>((set) => ({
  ...initialEditorState,
  setViewMode: (viewMode) => set({ viewMode, editorMode: 'select' }),
  setEditorMode: (editorMode) => set({ editorMode }),
  setSelection: (selection) => set({ selection }),
  clearSelection: () => set({ selection: { type: 'none' } }),
  setSelectedRackIds: (rackIds) => set({ selection: makeRackSelection(rackIds) }),
  setSelectedRackId: (rackId) => set({ selection: rackId ? { type: 'rack', rackIds: [rackId] } : { type: 'none' } }),
  toggleRackSelection: (rackId) => set((state) => {
    const current = getSelectedRackIds(state.selection);
    const next = current.includes(rackId)
      ? current.filter(id => id !== rackId)
      : [...current, rackId];
    return { selection: makeRackSelection(next) };
  }),
  setSelectedCellId: (cellId) => set({ selection: cellId ? { type: 'cell', cellId } : { type: 'none' } }),
  setSelectedContainerId: (containerId) => set({ selection: containerId ? { type: 'container', containerId } : { type: 'none' } }),
  setHoveredRackId: (hoveredRackId) => set({ hoveredRackId }),
  setCreatingRackId: (creatingRackId) => set({ creatingRackId }),
  setZoom: (zoom) => set({ zoom }),
  setMinRackDistance: (minRackDistance) => set({ minRackDistance }),
  resetDraft: () =>
    set({
      draft: null,
      draftSourceVersionId: null,
      selection: { type: 'none' },
      hoveredRackId: null,
      creatingRackId: null,
      isDraftDirty: false,
      editorMode: 'select',
      viewMode: 'layout'
    }),
  initializeDraft: (draft) =>
    set((state) => {
      if (state.isDraftDirty && state.draft?.layoutVersionId === draft.layoutVersionId) {
        return state;
      }

      const normalized = normalizeDraft(draft);
      const nextDraftState = normalized.draft;

      const currentRackIds = getSelectedRackIds(state.selection);
      const nextRackIds =
        currentRackIds.length > 0 && currentRackIds.every(id => nextDraftState.racks[id])
          ? currentRackIds
          : (nextDraftState.rackIds[0] ? [nextDraftState.rackIds[0]] : []);

      return {
        draft: nextDraftState,
        draftSourceVersionId: nextDraftState.layoutVersionId,
        selection: makeRackSelection(nextRackIds),
        isDraftDirty: normalized.changed
      };
    }),
  markDraftSaved: (layoutVersionId) =>
    set((state) => {
      if (!state.draft || state.draft.layoutVersionId !== layoutVersionId) {
        return state;
      }

      return {
        draftSourceVersionId: layoutVersionId,
        isDraftDirty: false
      };
    }),
  createRack: (x, y) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      const newRack = buildNewRack(state.draft.racks, x, y);
      const nextDraft = cloneDraft(state.draft);
      nextDraft.rackIds = [...nextDraft.rackIds, newRack.id];
      nextDraft.racks[newRack.id] = newRack;

      return {
        draft: nextDraft,
        selection: { type: 'rack', rackIds: [newRack.id] },
        creatingRackId: newRack.id,
        editorMode: 'select',
        isDraftDirty: true
      };
    }),
  deleteRack: (rackId) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      const nextDraft = cloneDraft(state.draft);
      delete nextDraft.racks[rackId];
      nextDraft.rackIds = nextDraft.rackIds.filter((id) => id !== rackId);

      return {
        draft: nextDraft,
        selection: makeRackSelection(getSelectedRackIds(state.selection).filter(id => id !== rackId)),
        creatingRackId: state.creatingRackId === rackId ? null : state.creatingRackId,
        isDraftDirty: true
      };
    }),
  duplicateRack: (rackId) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      const source = state.draft.racks[rackId];
      if (!source) return state;

      const newRackId = newEntityId();
      const nextDraft = cloneDraft(state.draft);
      const displayCode = nextRackDisplayCode(nextDraft.racks);

      // Deep-clone the rack and assign new IDs throughout
      const duplicate: Rack = {
        ...structuredClone(source),
        id: newRackId,
        displayCode,
        x: source.x + 80,
        y: source.y + 80,
        faces: source.faces.map((face) => ({
          ...face,
          id: newEntityId(),
          mirrorSourceFaceId: null,
          sections: face.sections.map((section) => ({
            ...section,
            id: newEntityId(),
            levels: section.levels.map((level) => ({
              ...level,
              id: newEntityId()
            }))
          }))
        }))
      };

      nextDraft.rackIds = [...nextDraft.rackIds, newRackId];
      nextDraft.racks[newRackId] = duplicate;

      return {
        draft: nextDraft,
        selection: { type: 'rack', rackIds: [newRackId] },
        isDraftDirty: true
      };
    }),
  updateRackPosition: (rackId, x, y) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      const rack = state.draft.racks[rackId];
      if (!rack) return state;

      // Validate position with minimum distance constraint
      const otherRacks = Object.values(state.draft.racks).filter(r => r.id !== rackId);
      const isValid = checkMinimumDistance({ ...rack, x, y }, x, y, otherRacks, state.minRackDistance);

      if (!isValid) {
        // Position violates minimum distance - reject update
        return state;
      }

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({ ...rack, x, y })),
        isDraftDirty: true
      };
    }),
  rotateRack: (rackId) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => {
          const newDeg = (((rack.rotationDeg + 90) % 360) as 0 | 90 | 180 | 270);
          // axis auto-syncs with visual rotation:
          //   0° / 180° → rack body is horizontal → WE (West–East)
          //   90° / 270° → rack body is vertical  → NS (North–South)
          const newAxis: Rack['axis'] = (newDeg === 90 || newDeg === 270) ? 'NS' : 'WE';
          return { ...rack, rotationDeg: newDeg, axis: newAxis };
        }),
        isDraftDirty: true
      };
    }),
  updateRackGeneral: (rackId, patch) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => normalizeRack({ ...rack, ...patch })),
        isDraftDirty: true
      };
    }),
  updateFaceConfig: (rackId, side, patch) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({
          ...rack,
          faces: rack.faces.map((face) => (face.side === side ? { ...face, ...patch } : face))
        })),
        isDraftDirty: true
      };
    }),
  updateSectionLength: (rackId, side, sectionId, length) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({
          ...rack,
          faces: rack.faces.map((face) =>
            face.side === side
              ? {
                  ...face,
                  sections: face.sections.map((section) => (section.id === sectionId ? { ...section, length } : section))
                }
              : face
          )
        })),
        isDraftDirty: true
      };
    }),
  updateSectionSlots: (rackId, side, sectionId, slotCount) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({
          ...rack,
          faces: rack.faces.map((face) =>
            face.side === side
              ? {
                  ...face,
                  sections: face.sections.map((section) =>
                    section.id === sectionId
                      ? { ...section, levels: section.levels.map((level) => ({ ...level, slotCount })) }
                      : section
                  )
                }
              : face
          )
        })),
        isDraftDirty: true
      };
    }),
  updateLevelCount: (rackId, side, sectionId, count) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({
          ...rack,
          faces: rack.faces.map((face) =>
            face.side === side
              ? {
                  ...face,
                  sections: face.sections.map((section) => {
                    if (section.id !== sectionId) return section;
                    const target = Math.max(1, count);
                    const currentSlotCount = section.levels[0]?.slotCount ?? 3;
                    if (target > section.levels.length) {
                      const toAdd = Array.from({ length: target - section.levels.length }, (_, i) => ({
                        id: newEntityId(),
                        ordinal: nextLevelOrdinal(section) + i,
                        slotCount: currentSlotCount
                      }));
                      return { ...section, levels: [...section.levels, ...toAdd] };
                    }
                    return { ...section, levels: section.levels.slice(0, target) };
                  })
                }
              : face
          )
        })),
        isDraftDirty: true
      };
    }),
  addSection: (rackId, side) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({
          ...rack,
          faces: rack.faces.map((face) =>
            face.side === side
              ? {
                  ...face,
                  sections: [
                    ...face.sections,
                    buildEmptySection(side, nextSectionOrdinal(face), face.sections[0]?.levels[0]?.slotCount ?? 3)
                  ]
                }
              : face
          )
        })),
        isDraftDirty: true
      };
    }),
  deleteSection: (rackId, side, sectionId) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({
          ...rack,
          faces: rack.faces.map((face) =>
            face.side === side
              ? { ...face, sections: face.sections.filter((section) => section.id !== sectionId) }
              : face
          )
        })),
        isDraftDirty: true
      };
    }),
  addLevel: (rackId, side, sectionId) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({
          ...rack,
          faces: rack.faces.map((face) =>
            face.side === side
              ? {
                  ...face,
                  sections: face.sections.map((section) =>
                    section.id === sectionId
                      ? {
                          ...section,
                          levels: [
                            ...section.levels,
                            {
                              id: newEntityId(),
                              ordinal: nextLevelOrdinal(section),
                              slotCount: section.levels[0]?.slotCount ?? 3
                            }
                          ]
                        }
                      : section
                  )
                }
              : face
          )
        })),
        isDraftDirty: true
      };
    }),
  applyFacePreset: (rackId, side, sectionCount, levelCount, slotCount) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => {
          const face = rack.faces.find((f) => f.side === side);
          // Use per-face length if set (asymmetric paired rack), else fall back to rack total
          const totalLength = face?.faceLength ?? rack.totalLength;
          const baseLength = Math.floor((totalLength / sectionCount) * 100) / 100;
          // Last section absorbs rounding remainder
          const lastLength = Math.round((totalLength - baseLength * (sectionCount - 1)) * 100) / 100;

          return {
            ...rack,
            faces: rack.faces.map((face) => {
              if (face.side !== side) return face;

              const sections = Array.from({ length: sectionCount }, (_, i) => {
                const ordinal = i + 1;
                const length = i === sectionCount - 1 ? lastLength : baseLength;
                return {
                  id: newEntityId(),
                  ordinal,
                  length,
                  levels: Array.from({ length: levelCount }, (__, j) => ({
                    id: newEntityId(),
                    ordinal: j + 1,
                    slotCount
                  }))
                };
              });

              return { ...face, sections };
            })
          };
        }),
        isDraftDirty: true
      };
    }),
  resetFaceB: (rackId) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({
          ...rack,
          kind: 'single' as RackKind,
          faces: rack.faces.map((face) =>
            face.side === 'B'
              ? { ...face, enabled: false, isMirrored: false, mirrorSourceFaceId: null, sections: [] }
              : face
          )
        })),
        isDraftDirty: true
      };
    }),
  setFaceLength: (rackId, side, length) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) =>
          normalizeRack({
            ...rack,
            faces: rack.faces.map((face) => {
              if (face.side === side) {
                return { ...face, faceLength: length };
              }

              if (side === 'A' && face.side === 'B' && face.isMirrored) {
                return { ...face, faceLength: undefined };
              }

              return face;
            })
          })
        ),
        isDraftDirty: true
      };
    }),
  setFaceBMode: (rackId, mode) =>
    set((state) => {
      if (!canEditDraft(state.draft)) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => {
          const faceA = rack.faces.find((face) => face.side === 'A');
          const faceB = rack.faces.find((face) => face.side === 'B');

          if (!faceA || !faceB) {
            return rack;
          }

          const sectionsCopy = faceA.sections.map((section) => ({
            ...section,
            id: newEntityId(),
            levels: section.levels.map((level) => ({
              ...level,
              id: newEntityId()
            }))
          }));

          let nextFaceB: RackFace = faceB;

          if (mode === 'mirror') {
            nextFaceB = {
              ...faceB,
              enabled: true,
              isMirrored: true,
              mirrorSourceFaceId: faceA.id,
              faceLength: undefined,
              slotNumberingDirection: 'rtl' as SlotNumberingDirection,
              sections: []
            };
          }

          if (mode === 'copy') {
            nextFaceB = {
              ...faceB,
              enabled: true,
              isMirrored: false,
              mirrorSourceFaceId: null,
              sections: sectionsCopy
            };
          }

          if (mode === 'scratch') {
            nextFaceB = {
              ...faceB,
              enabled: true,
              isMirrored: false,
              mirrorSourceFaceId: null,
              sections: [buildEmptySection('B', 1, 3, faceB.faceLength ?? rack.totalLength)]
            };
          }

          return {
            ...rack,
            kind: 'paired' as RackKind,
            faces: rack.faces.map((face) => (face.side === 'B' ? nextFaceB : face))
          };
        }),
        isDraftDirty: true
      };
    }),
  alignRacksHorizontal: (rackIds) =>
    set((state) => {
      if (!canEditDraft(state.draft) || rackIds.length < 2) return state;

      const racks = rackIds.map(id => state.draft!.racks[id]).filter(Boolean);
      if (racks.length < 2) return state;

      // Use first rack's Y as reference
      const referenceY = racks[0].y;
      const updates = alignRacksToLine(racks, 'y', referenceY);

      let nextDraft = cloneDraft(state.draft);
      for (const [rackId, pos] of Object.entries(updates)) {
        nextDraft = updateRackInDraft(nextDraft, rackId, (rack) => ({ ...rack, ...pos }));
      }

      return {
        draft: nextDraft,
        isDraftDirty: true
      };
    }),
  alignRacksVertical: (rackIds) =>
    set((state) => {
      if (!canEditDraft(state.draft) || rackIds.length < 2) return state;

      const racks = rackIds.map(id => state.draft!.racks[id]).filter(Boolean);
      if (racks.length < 2) return state;

      // Use first rack's X as reference
      const referenceX = racks[0].x;
      const updates = alignRacksToLine(racks, 'x', referenceX);

      let nextDraft = cloneDraft(state.draft);
      for (const [rackId, pos] of Object.entries(updates)) {
        nextDraft = updateRackInDraft(nextDraft, rackId, (rack) => ({ ...rack, ...pos }));
      }

      return {
        draft: nextDraft,
        isDraftDirty: true
      };
    }),
  distributeRacksEqual: (rackIds, axis) =>
    set((state) => {
      if (!canEditDraft(state.draft) || rackIds.length < 2) return state;

      const racks = rackIds.map(id => state.draft!.racks[id]).filter(Boolean);
      if (racks.length < 2) return state;

      const updates = distributeRacksEqually(racks, axis, state.minRackDistance);

      let nextDraft = cloneDraft(state.draft);
      for (const [rackId, pos] of Object.entries(updates)) {
        nextDraft = updateRackInDraft(nextDraft, rackId, (rack) => ({ ...rack, ...pos }));
      }

      return {
        draft: nextDraft,
        isDraftDirty: true
      };
    })
}));

export function resetEditorStore() {
  useEditorStore.setState(initialEditorState);
}
