import type { LayoutDraft, Rack, RackFace, RackKind, SlotNumberingDirection } from '@wos/domain';
import { create } from 'zustand';
import type { EditorMode } from './editor-types';

type EditorStore = {
  editorMode: EditorMode;
  selectedRackId: string | null;
  hoveredRackId: string | null;
  /** ID of the rack currently going through the creation wizard. Cleared on wizard finish/cancel. */
  creatingRackId: string | null;
  zoom: number;
  draft: LayoutDraft | null;
  draftSourceVersionId: string | null;
  isDraftDirty: boolean;
  setEditorMode: (mode: EditorMode) => void;
  setSelectedRackId: (rackId: string | null) => void;
  setHoveredRackId: (rackId: string | null) => void;
  setCreatingRackId: (rackId: string | null) => void;
  setZoom: (zoom: number) => void;
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
};

function cloneDraft(draft: LayoutDraft): LayoutDraft {
  return structuredClone(draft);
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

function buildEmptySection(side: 'A' | 'B', ordinal: number, slotCount = 3) {
  return {
    id: `sec-${side.toLowerCase()}-${ordinal}-${crypto.randomUUID()}`,
    ordinal,
    length: 2.5,
    levels: [{ id: `lvl-${side.toLowerCase()}-${ordinal}-1-${crypto.randomUUID()}`, ordinal: 1, slotCount }]
  };
}

function nextRackDisplayCode(racks: Record<string, Rack>): string {
  const numerics = Object.values(racks)
    .map((r) => parseInt(r.displayCode, 10))
    .filter((n) => !isNaN(n));
  const max = numerics.length > 0 ? Math.max(...numerics) : 0;
  return String(max + 1).padStart(2, '0');
}

function buildNewRack(racks: Record<string, Rack>, x: number, y: number): Rack {
  const rackId = crypto.randomUUID();
  const faceAId = crypto.randomUUID();
  const faceBId = crypto.randomUUID();
  const displayCode = nextRackDisplayCode(racks);

  return {
    id: rackId,
    displayCode,
    kind: 'single',
    axis: 'NS',
    x,
    y,
    totalLength: 5,
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
        sections: [buildEmptySection('A', 1)]
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
  editorMode: 'select',
  selectedRackId: null,
  hoveredRackId: null,
  creatingRackId: null,
  zoom: 1,
  draft: null,
  draftSourceVersionId: null,
  isDraftDirty: false,
  setEditorMode: (editorMode) => set({ editorMode }),
  setSelectedRackId: (selectedRackId) => set({ selectedRackId }),
  setHoveredRackId: (hoveredRackId) => set({ hoveredRackId }),
  setCreatingRackId: (creatingRackId) => set({ creatingRackId }),
  setZoom: (zoom) => set({ zoom }),
  resetDraft: () =>
    set({
      draft: null,
      draftSourceVersionId: null,
      selectedRackId: null,
      hoveredRackId: null,
      creatingRackId: null,
      isDraftDirty: false,
      editorMode: 'select'
    }),
  initializeDraft: (draft) =>
    set((state) => {
      if (state.isDraftDirty && state.draft?.layoutVersionId === draft.layoutVersionId) {
        return state;
      }

      const nextSelectedRackId =
        state.selectedRackId && draft.racks[state.selectedRackId]
          ? state.selectedRackId
          : (draft.rackIds[0] ?? null);

      return {
        draft: cloneDraft(draft),
        draftSourceVersionId: draft.layoutVersionId,
        selectedRackId: nextSelectedRackId,
        isDraftDirty: false
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
      if (!state.draft) return state;

      const newRack = buildNewRack(state.draft.racks, x, y);
      const nextDraft = cloneDraft(state.draft);
      nextDraft.rackIds = [...nextDraft.rackIds, newRack.id];
      nextDraft.racks[newRack.id] = newRack;

      return {
        draft: nextDraft,
        selectedRackId: newRack.id,
        creatingRackId: newRack.id,
        editorMode: 'select',
        isDraftDirty: true
      };
    }),
  deleteRack: (rackId) =>
    set((state) => {
      if (!state.draft) return state;

      const nextDraft = cloneDraft(state.draft);
      delete nextDraft.racks[rackId];
      nextDraft.rackIds = nextDraft.rackIds.filter((id) => id !== rackId);

      return {
        draft: nextDraft,
        selectedRackId: state.selectedRackId === rackId ? null : state.selectedRackId,
        creatingRackId: state.creatingRackId === rackId ? null : state.creatingRackId,
        isDraftDirty: true
      };
    }),
  duplicateRack: (rackId) =>
    set((state) => {
      if (!state.draft) return state;

      const source = state.draft.racks[rackId];
      if (!source) return state;

      const newRackId = crypto.randomUUID();
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
          id: crypto.randomUUID(),
          mirrorSourceFaceId: null,
          sections: face.sections.map((section) => ({
            ...section,
            id: `sec-${face.side.toLowerCase()}-${section.ordinal}-${crypto.randomUUID()}`,
            levels: section.levels.map((level) => ({
              ...level,
              id: `lvl-${face.side.toLowerCase()}-${section.ordinal}-${level.ordinal}-${crypto.randomUUID()}`
            }))
          }))
        }))
      };

      nextDraft.rackIds = [...nextDraft.rackIds, newRackId];
      nextDraft.racks[newRackId] = duplicate;

      return {
        draft: nextDraft,
        selectedRackId: newRackId,
        isDraftDirty: true
      };
    }),
  updateRackPosition: (rackId, x, y) =>
    set((state) => {
      if (!state.draft) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({ ...rack, x, y })),
        isDraftDirty: true
      };
    }),
  rotateRack: (rackId) =>
    set((state) => {
      if (!state.draft) return state;

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
      if (!state.draft) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({ ...rack, ...patch })),
        isDraftDirty: true
      };
    }),
  updateFaceConfig: (rackId, side, patch) =>
    set((state) => {
      if (!state.draft) return state;

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
      if (!state.draft) return state;

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
      if (!state.draft) return state;

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
      if (!state.draft) return state;

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
                        id: `lvl-${side.toLowerCase()}-${section.ordinal}-${nextLevelOrdinal(section) + i}-${crypto.randomUUID()}`,
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
      if (!state.draft) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({
          ...rack,
          faces: rack.faces.map((face) =>
            face.side === side
              ? {
                  ...face,
                  sections: [...face.sections, buildEmptySection(side, nextSectionOrdinal(face))]
                }
              : face
          )
        })),
        isDraftDirty: true
      };
    }),
  deleteSection: (rackId, side, sectionId) =>
    set((state) => {
      if (!state.draft) return state;

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
      if (!state.draft) return state;

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
                              id: `lvl-${side.toLowerCase()}-${section.ordinal}-${nextLevelOrdinal(section)}-${crypto.randomUUID()}`,
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
      if (!state.draft) return state;

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
                  id: `sec-${side.toLowerCase()}-${ordinal}-${crypto.randomUUID()}`,
                  ordinal,
                  length,
                  levels: Array.from({ length: levelCount }, (__, j) => ({
                    id: `lvl-${side.toLowerCase()}-${ordinal}-${j + 1}-${crypto.randomUUID()}`,
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
      if (!state.draft) return state;

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
      if (!state.draft) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({
          ...rack,
          faces: rack.faces.map((face) =>
            face.side === side ? { ...face, faceLength: length } : face
          )
        })),
        isDraftDirty: true
      };
    }),
  setFaceBMode: (rackId, mode) =>
    set((state) => {
      if (!state.draft) return state;

      return {
        draft: updateRackInDraft(state.draft, rackId, (rack) => {
          const faceA = rack.faces.find((face) => face.side === 'A');
          const faceB = rack.faces.find((face) => face.side === 'B');

          if (!faceA || !faceB) {
            return rack;
          }

          const sectionsCopy = faceA.sections.map((section) => ({
            ...section,
            id: `sec-b-${section.ordinal}-${crypto.randomUUID()}`,
            levels: section.levels.map((level) => ({
              ...level,
              id: `lvl-b-${section.ordinal}-${level.ordinal}-${crypto.randomUUID()}`
            }))
          }));

          let nextFaceB: RackFace = faceB;

          if (mode === 'mirror') {
            nextFaceB = {
              ...faceB,
              enabled: true,
              isMirrored: true,
              mirrorSourceFaceId: faceA.id,
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
              sections: [buildEmptySection('B', 1)]
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
    })
}));
