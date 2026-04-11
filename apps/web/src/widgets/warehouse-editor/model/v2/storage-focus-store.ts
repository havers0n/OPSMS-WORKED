import { create } from 'zustand'

/**
 * StorageFocusStore — the single source of truth for Storage V2 runtime focus.
 *
 * PR7: Replaces the dual read/write pattern across navigation-store + selection-store
 * that existed through PR1–PR6. All Storage V2 components must read and write
 * focus exclusively through this store.
 *
 * Writers (in priority order):
 *   1. Canvas (primary) — cell click, rack click, empty-canvas click
 *   2. StorageNavigator (secondary) — location list click, level tab click
 *
 * Reader:
 *   - StorageInspectorV2 — derives data pipeline from selectedCellId
 *   - StorageNavigator — derives rack display and list filtering from selectedRackId + activeLevel
 *
 * Invariants:
 *   - selectCell always sets all three fields (cellId, rackId, level) atomically
 *   - selectRack always clears selectedCellId (rack-level focus, not cell)
 *   - setActiveLevel always clears selectedCellId (level changed, prior cell is stale)
 *   - handleEmptyCanvasClick implements two-click collapse:
 *       click #1: clearCell (keep rack+level context), counter → 1
 *       click #2 (consecutive): clearAllFocus, counter → 0
 *
 * Non-goals:
 *   - Does not store workflow/task state (see task-store)
 *   - Does not hold published cell data; level derivation is done by callers
 */

export type StorageFocusStore = {
  selectedCellId: string | null
  selectedRackId: string | null
  activeLevel: number | null
  /** Internal control state — not for UI consumption. */
  _consecutiveEmptyCanvasClicks: number

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Primary selection action.
   * Sets cell + rack + level coherently and resets the empty-click counter.
   * `level: null` clears the active level (rarely desired — callers should
   * resolve the level from published cell data before calling).
   */
  selectCell: (params: { cellId: string; rackId: string; level: number | null }) => void

  /**
   * Rack-level selection (no cell selected).
   * Clears selectedCellId, sets rack and optional level, resets counter.
   */
  selectRack: (params: { rackId: string; level?: number | null }) => void

  /**
   * Level tab navigation.
   * Updates activeLevel, preserves selectedRackId, clears selectedCellId
   * (the cell was on the prior level), resets counter.
   */
  setActiveLevel: (level: number) => void

  /**
   * Deselect cell only — keep rack + level context.
   */
  clearCell: () => void

  /**
   * Full focus reset — clears cell, rack, level, and counter.
   */
  clearAllFocus: () => void

  /**
   * Two-click collapse for empty-canvas interactions.
   * click #1: clearCell, counter → 1
   * click #2 (consecutive, counter ≥ 1): clearAllFocus, counter → 0
   */
  handleEmptyCanvasClick: () => void
}

const initialState = {
  selectedCellId: null,
  selectedRackId: null,
  activeLevel: null,
  _consecutiveEmptyCanvasClicks: 0,
}

export const useStorageFocusStore = create<StorageFocusStore>((set) => ({
  ...initialState,

  selectCell: ({ cellId, rackId, level }) =>
    set({
      selectedCellId: cellId,
      selectedRackId: rackId,
      activeLevel: level,
      _consecutiveEmptyCanvasClicks: 0,
    }),

  selectRack: ({ rackId, level = null }) =>
    set({
      selectedCellId: null,
      selectedRackId: rackId,
      activeLevel: level,
      _consecutiveEmptyCanvasClicks: 0,
    }),

  setActiveLevel: (level) =>
    set({
      activeLevel: level,
      // Cell is on the prior level — it is no longer in the current view
      selectedCellId: null,
      _consecutiveEmptyCanvasClicks: 0,
    }),

  clearCell: () =>
    set((state) => ({
      selectedCellId: null,
      _consecutiveEmptyCanvasClicks: state._consecutiveEmptyCanvasClicks + 1,
    })),

  clearAllFocus: () =>
    set({
      selectedCellId: null,
      selectedRackId: null,
      activeLevel: null,
      _consecutiveEmptyCanvasClicks: 0,
    }),

  handleEmptyCanvasClick: () =>
    set((state) => {
      if (state.selectedCellId !== null) {
        // Click #1: cell is selected — deselect it, preserve rack+level
        return {
          selectedCellId: null,
          _consecutiveEmptyCanvasClicks: 1,
        }
      }
      if (state._consecutiveEmptyCanvasClicks >= 1) {
        // Click #2 (consecutive): full focus reset
        return {
          selectedCellId: null,
          selectedRackId: null,
          activeLevel: null,
          _consecutiveEmptyCanvasClicks: 0,
        }
      }
      // Already cleared and counter is 0 — no meaningful state change
      return state
    }),
}))

export function resetStorageFocusStore(): void {
  useStorageFocusStore.setState(initialState)
}
