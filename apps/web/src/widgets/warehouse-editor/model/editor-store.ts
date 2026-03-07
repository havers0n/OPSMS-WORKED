import type { LayoutDraft, Rack, RackFace, RackFaceAnchor, RackKind, SlotNumberingDirection } from '@wos/domain';
import { create } from 'zustand';

type EditorStore = {
  selectedRackId: string | null;
  hoveredRackId: string | null;
  zoom: number;
  draft: LayoutDraft | null;
  draftSourceVersionId: string | null;
  isDraftDirty: boolean;
  setSelectedRackId: (rackId: string | null) => void;
  setHoveredRackId: (rackId: string | null) => void;
  setZoom: (zoom: number) => void;
  resetDraft: () => void;
  initializeDraft: (draft: LayoutDraft) => void;
  markDraftSaved: (layoutVersionId: string) => void;
  updateRackPosition: (rackId: string, x: number, y: number) => void;
  rotateRack: (rackId: string) => void;
  updateRackGeneral: (rackId: string, patch: Partial<Pick<Rack, 'displayCode' | 'kind' | 'axis' | 'totalLength' | 'depth'>>) => void;
  updateFaceConfig: (rackId: string, side: 'A' | 'B', patch: Partial<Pick<RackFace, 'anchor' | 'slotNumberingDirection' | 'enabled'>>) => void;
  updateSectionLength: (rackId: string, side: 'A' | 'B', sectionId: string, length: number) => void;
  addSection: (rackId: string, side: 'A' | 'B') => void;
  addLevel: (rackId: string, side: 'A' | 'B', sectionId: string) => void;
  setFaceBMode: (rackId: string, mode: 'mirror' | 'copy' | 'scratch') => void;
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

function buildEmptySection(side: 'A' | 'B', ordinal: number) {
  return {
    id: `sec-${side.toLowerCase()}-${ordinal}-${crypto.randomUUID()}`,
    ordinal,
    length: 2.5,
    levels: [{ id: `lvl-${side.toLowerCase()}-${ordinal}-1-${crypto.randomUUID()}`, ordinal: 1, slotCount: 3 }]
  };
}

export const useEditorStore = create<EditorStore>((set) => ({
  selectedRackId: null,
  hoveredRackId: null,
  zoom: 1,
  draft: null,
  draftSourceVersionId: null,
  isDraftDirty: false,
  setSelectedRackId: (selectedRackId) => set({ selectedRackId }),
  setHoveredRackId: (hoveredRackId) => set({ hoveredRackId }),
  setZoom: (zoom) => set({ zoom }),
  resetDraft: () =>
    set({
      draft: null,
      draftSourceVersionId: null,
      selectedRackId: null,
      hoveredRackId: null,
      isDraftDirty: false
    }),
  initializeDraft: (draft) =>
    set((state) => {
      if (state.isDraftDirty && state.draft?.layoutVersionId === draft.layoutVersionId) {
        return state;
      }

      return {
        draft: cloneDraft(draft),
        draftSourceVersionId: draft.layoutVersionId,
        selectedRackId: state.selectedRackId && draft.racks[state.selectedRackId] ? state.selectedRackId : draft.rackIds[0] ?? null,
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
        draft: updateRackInDraft(state.draft, rackId, (rack) => ({
          ...rack,
          rotationDeg: (((rack.rotationDeg + 90) % 360) as 0 | 90 | 180 | 270)
        })),
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
                              slotCount: 3
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
              anchor: 'end' as RackFaceAnchor,
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
