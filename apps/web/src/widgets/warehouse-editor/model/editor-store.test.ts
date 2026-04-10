import { afterEach, describe, expect, it } from 'vitest';
import { mapLayoutDraftToSavePayload } from '@/features/layout-draft-save/api/mappers';
import { createLayoutDraftFixture } from './__fixtures__/layout-draft.fixture';
import { useEditorStore } from '@/widgets/warehouse-editor/model/editor-store';
import { useInteractionStore } from '@/widgets/warehouse-editor/model/interaction-store';
import { useModeStore } from '@/widgets/warehouse-editor/model/mode-store';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resetStore() {
  // Reset mode-store
  useModeStore.setState({
    viewMode: 'layout',
    editorMode: 'select'
  });

  // Reset editor-store
  useEditorStore.setState({
    objectWorkContext: 'geometry',
    activeTask: null,
    activeStorageWorkflow: null,
    minRackDistance: 0,
    draft: null,
    draftSourceVersionId: null,
    isDraftDirty: false,
    persistenceStatus: 'idle',
    lastSaveErrorMessage: null,
    lastChangeClass: null
  });

  // Reset interaction-store
  useInteractionStore.setState({ selection: { type: 'none' }, hoveredRackId: null, highlightedCellIds: [], contextPanelMode: 'compact' });
}

function createUuidLayoutDraftFixture() {
  return {
    layoutVersionId: crypto.randomUUID(),
    draftVersion: 1,
    floorId: crypto.randomUUID(),
    state: 'draft' as const,
    rackIds: [],
    racks: {},
    zoneIds: [],
    zones: {},
    wallIds: [],
    walls: {}
  };
}

afterEach(() => {
  resetStore();
});

describe('editor-store', () => {
  it('defaults objectWorkContext to geometry', () => {
    expect(useEditorStore.getState().objectWorkContext).toBe('geometry');
  });

  it('resets objectWorkContext to geometry when a different single rack is selected', () => {
    const draft = createLayoutDraftFixture();
    const otherRackId = 'rack-2';
    draft.rackIds.push(otherRackId);
    draft.racks[otherRackId] = {
      ...draft.racks[draft.rackIds[0]],
      id: otherRackId,
      displayCode: '02'
    };

    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().setSelectedRackId(draft.rackIds[0]);
    useEditorStore.getState().setObjectWorkContext('structure');

    useEditorStore.getState().setSelectedRackId(otherRackId);

    expect(useEditorStore.getState().objectWorkContext).toBe('geometry');
  });

  it('does not reset objectWorkContext when the same single rack focus changes', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];

    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().setSelectedRackId(rackId);
    useEditorStore.getState().setObjectWorkContext('structure');

    useEditorStore.getState().setSelectedRackSide(rackId, 'east');

    expect(useEditorStore.getState().objectWorkContext).toBe('structure');
  });

  it('resets objectWorkContext when leaving single-rack inspection', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];

    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().setSelectedRackId(rackId);
    useEditorStore.getState().setObjectWorkContext('structure');

    useEditorStore.getState().setSelectedZoneId('zone-1');

    expect(useEditorStore.getState().objectWorkContext).toBe('geometry');
  });

  it('resets objectWorkContext on view mode change and draft reset', () => {
    useEditorStore.getState().setObjectWorkContext('structure');
    useEditorStore.getState().setViewMode('storage');
    expect(useEditorStore.getState().objectWorkContext).toBe('geometry');

    useEditorStore.getState().setObjectWorkContext('structure');
    useEditorStore.getState().resetDraft();
    expect(useEditorStore.getState().objectWorkContext).toBe('geometry');
  });

  it('normalizes legacy mode names onto the new mode model', () => {
    useEditorStore.getState().setViewMode('placement');
    expect(useModeStore.getState().viewMode).toBe('storage');

    useEditorStore.getState().setViewMode('operations');
    expect(useModeStore.getState().viewMode).toBe('view');
  });

  it('initializes live draft into local state', () => {
    const draft = createLayoutDraftFixture();

    useEditorStore.getState().initializeDraft(draft);

    expect(useEditorStore.getState().draft?.layoutVersionId).toBe(draft.layoutVersionId);
    expect(useEditorStore.getState().draft?.draftVersion).toBe(draft.draftVersion);
    expect(useEditorStore.getState().draft?.state).toBe('draft');
    expect(useInteractionStore.getState().selection.type).toBe('none');
    expect(useEditorStore.getState().isDraftDirty).toBe(false);
  });

  it('does not overwrite a dirty draft when the same layout version re-queries', () => {
    const draft = createLayoutDraftFixture();
    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().updateRackPosition(draft.rackIds[0], 100, 200);

    const dirtyDraft = useEditorStore.getState().draft;
    useEditorStore.getState().initializeDraft(createLayoutDraftFixture());

    expect(useEditorStore.getState().draft).toEqual(dirtyDraft);
    expect(useEditorStore.getState().isDraftDirty).toBe(true);
  });

  it('blocks same-layoutVersionId refetch even after markDraftSaved (no stale overwrite)', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().updateRackPosition(rackId, 50, 60);
    useEditorStore.getState().markDraftSaved({
      layoutVersionId: draft.layoutVersionId,
      draftVersion: 2,
      changeClass: 'geometry_only'
    });

    expect(useEditorStore.getState().isDraftDirty).toBe(false);
    expect(useEditorStore.getState().draft?.draftVersion).toBe(2);

    // A stale workspace refetch (with pre-save positions) must be blocked
    const staleDraft = createLayoutDraftFixture(); // same layoutVersionId, old positions
    staleDraft.racks[rackId] = { ...staleDraft.racks[rackId], x: 20, y: 30 };
    useEditorStore.getState().initializeDraft(staleDraft);

    // Positions must stay at the saved values, not revert to pre-save
    expect(useEditorStore.getState().draft?.racks[rackId]?.x).toBe(50);
    expect(useEditorStore.getState().draft?.racks[rackId]?.y).toBe(60);
    expect(useEditorStore.getState().isDraftDirty).toBe(false);
  });

  it('blocks stale duplicate refetch for newly initialized draft', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    useEditorStore.getState().initializeDraft(draft);

    const staleDraft = createLayoutDraftFixture(); // same layoutVersionId, different positions
    staleDraft.racks[rackId] = { ...staleDraft.racks[rackId], x: 5, y: 5 };
    useEditorStore.getState().initializeDraft(staleDraft);

    // Store must not accept the stale duplicate
    expect(useEditorStore.getState().draft?.racks[rackId]?.x).toBe(20);
    expect(useEditorStore.getState().draft?.racks[rackId]?.y).toBe(30);
  });

  it('markDraftSaved clears dirty state for the active draft version', () => {
    const draft = createLayoutDraftFixture();
    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().updateRackPosition(draft.rackIds[0], 100, 200);

    useEditorStore.getState().markDraftSaved({
      layoutVersionId: draft.layoutVersionId,
      draftVersion: 2,
      changeClass: 'geometry_only'
    });

    expect(useEditorStore.getState().isDraftDirty).toBe(false);
    expect(useEditorStore.getState().draft?.layoutVersionId).toBe(draft.layoutVersionId);
    expect(useEditorStore.getState().draft?.draftVersion).toBe(2);
    expect(useEditorStore.getState().persistenceStatus).toBe('saved');
    expect(useEditorStore.getState().lastChangeClass).toBe('geometry_only');
  });

  it('keeps dirty state when a save finishes after newer local edits', () => {
    const draft = createLayoutDraftFixture();
    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().updateRackPosition(draft.rackIds[0], 100, 200);
    useEditorStore.getState().markDraftSaving({ layoutVersionId: draft.layoutVersionId });

    useEditorStore.getState().markDraftSaved({
      layoutVersionId: draft.layoutVersionId,
      draftVersion: 2,
      changeClass: 'geometry_only',
      keepDirty: true
    });

    expect(useEditorStore.getState().isDraftDirty).toBe(true);
    expect(useEditorStore.getState().persistenceStatus).toBe('dirty');
    expect(useEditorStore.getState().draft?.draftVersion).toBe(2);
  });

  it('marks conflicts as a hard-stop persistence status', () => {
    const draft = createLayoutDraftFixture();
    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().markDraftSaveConflict({
      layoutVersionId: draft.layoutVersionId,
      message: 'Layout draft was changed by another session. Please reload.'
    });

    expect(useEditorStore.getState().persistenceStatus).toBe('conflict');
    expect(useEditorStore.getState().lastSaveErrorMessage).toContain('Please reload');
  });

  it('returns to dirty after the next edit following a save error', () => {
    const draft = createLayoutDraftFixture();
    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().markDraftSaveError({
      layoutVersionId: draft.layoutVersionId,
      message: 'Save failed'
    });

    expect(useEditorStore.getState().persistenceStatus).toBe('error');

    useEditorStore.getState().updateRackPosition(draft.rackIds[0], 150, 250);

    expect(useEditorStore.getState().persistenceStatus).toBe('dirty');
  });

  it('creates, updates, and deletes a zone as first-class draft state', () => {
    const draft = createLayoutDraftFixture();
    useEditorStore.getState().initializeDraft(draft);

    useEditorStore.getState().createZone({ x: 40, y: 80, width: 200, height: 120 });

    const createdZoneId = useEditorStore.getState().draft?.zoneIds[0] ?? null;
    expect(createdZoneId).toBeTruthy();
    expect(useInteractionStore.getState().selection).toEqual({
      type: 'zone',
      zoneId: createdZoneId
    });

    useEditorStore.getState().updateZoneDetails(createdZoneId!, {
      name: 'Inbound staging',
      category: 'staging',
      color: '#34d399'
    });
    useEditorStore.getState().updateZoneRect(createdZoneId!, {
      x: -120,
      y: -160,
      width: 240,
      height: 200
    });

    expect(useEditorStore.getState().draft?.zones[createdZoneId!]).toEqual(
      expect.objectContaining({
        id: createdZoneId,
        code: 'Z01',
        name: 'Inbound staging',
        category: 'staging',
        color: '#34d399',
        x: -120,
        y: -160,
        width: 240,
        height: 200
      })
    );

    useEditorStore.getState().deleteZone(createdZoneId!);

    expect(useEditorStore.getState().draft?.zoneIds).toEqual([]);
    expect(useEditorStore.getState().draft?.zones).toEqual({});
    expect(useInteractionStore.getState().selection.type).toBe('none');
    expect(useEditorStore.getState().isDraftDirty).toBe(true);
  });

  it('creates a standalone wall from a selected rack side seed and keeps the rack independent', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    useEditorStore.getState().initializeDraft(draft);

    useEditorStore.getState().createWallFromRackSide(rackId, 'east');

    const wallId = useEditorStore.getState().draft?.wallIds[0] ?? null;
    expect(wallId).toBeTruthy();
    expect(useInteractionStore.getState().selection).toEqual({
      type: 'wall',
      wallId
    });

    const createdWall = useEditorStore.getState().draft?.walls[wallId!];
    expect(createdWall).toEqual(
      expect.objectContaining({
        id: wallId,
        code: 'W01',
        wallType: 'generic',
        blocksRackPlacement: true,
        x1: 25,
        x2: 25,
        y1: 30,
        y2: 31
      })
    );

    useEditorStore.getState().updateRackPosition(rackId, 500, 600);

    expect(useEditorStore.getState().draft?.walls[wallId!]).toEqual(createdWall);
    expect(useEditorStore.getState().draft?.racks[rackId]).toEqual(
      expect.objectContaining({
        x: 500,
        y: 600
      })
    );
  });

  it('keeps wall endpoint edits axis-aligned and supports deletion', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().createWallFromRackSide(rackId, 'north');

    const wallId = useEditorStore.getState().draft?.wallIds[0] ?? null;
    expect(wallId).toBeTruthy();

    useEditorStore.getState().updateWallGeometry(wallId!, {
      x1: -40,
      y1: -8,
      x2: 240,
      y2: 180
    });
    useEditorStore.getState().updateWallDetails(wallId!, {
      code: 'W99',
      name: 'North divider',
      wallType: 'partition',
      blocksRackPlacement: false
    });

    expect(useEditorStore.getState().draft?.walls[wallId!]).toEqual(
      expect.objectContaining({
        code: 'W99',
        name: 'North divider',
        wallType: 'partition',
        blocksRackPlacement: false,
        x1: -40,
        y1: -8,
        x2: 240,
        y2: -8
      })
    );

    useEditorStore.getState().deleteWall(wallId!);

    expect(useEditorStore.getState().draft?.wallIds).toEqual([]);
    expect(useEditorStore.getState().draft?.walls).toEqual({});
    expect(useInteractionStore.getState().selection.type).toBe('none');
  });

  it('createFreeWall creates a horizontal wall from a left-to-right drag', () => {
    const draft = createUuidLayoutDraftFixture();
    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().setEditorMode('draw-wall');

    // 120px horizontal drag (>= MIN_WALL_LENGTH of 40px)
    useEditorStore.getState().createFreeWall(0, 40, 120, 55);

    const wallId = useEditorStore.getState().draft?.wallIds[0] ?? null;
    expect(wallId).toBeTruthy();

    const wall = useEditorStore.getState().draft?.walls[wallId!];
    expect(wall).toEqual(
      expect.objectContaining({
        code: 'W01',
        wallType: 'generic',
        blocksRackPlacement: true,
        x1: 0,
        y1: 40,
        x2: 120,
        y2: 40  // axis-locked to start Y
      })
    );
    expect(useInteractionStore.getState().selection).toEqual({ type: 'wall', wallId });
    expect(useModeStore.getState().editorMode).toBe('select');
    expect(useEditorStore.getState().isDraftDirty).toBe(true);
  });

  it('createFreeWall creates a vertical wall from a top-to-bottom drag', () => {
    const draft = createUuidLayoutDraftFixture();
    useEditorStore.getState().initializeDraft(draft);

    // 160px vertical drag (dy > dx)
    useEditorStore.getState().createFreeWall(80, 0, 85, 160);

    const wallId = useEditorStore.getState().draft?.wallIds[0] ?? null;
    expect(wallId).toBeTruthy();

    const wall = useEditorStore.getState().draft?.walls[wallId!];
    expect(wall).toEqual(
      expect.objectContaining({
        code: 'W01',
        wallType: 'generic',
        blocksRackPlacement: true,
        x1: 80,
        y1: 0,
        x2: 80,  // axis-locked to start X
        y2: 160
      })
    );
  });

  it('createFreeWall is a no-op when the drag is shorter than MIN_WALL_LENGTH', () => {
    const draft = createUuidLayoutDraftFixture();
    useEditorStore.getState().initializeDraft(draft);

    // 0.4 m drag — rounds to 0, producing zero length, below MIN_WALL_LENGTH (1 m)
    useEditorStore.getState().createFreeWall(0, 0, 0.4, 0);

    expect(useEditorStore.getState().draft?.wallIds).toHaveLength(0);
    expect(useInteractionStore.getState().selection.type).toBe('none');
    expect(useEditorStore.getState().isDraftDirty).toBe(false);
  });

  it('createFreeWall is a no-op for a zero-length gesture', () => {
    const draft = createUuidLayoutDraftFixture();
    useEditorStore.getState().initializeDraft(draft);

    useEditorStore.getState().createFreeWall(40, 40, 40, 40);

    expect(useEditorStore.getState().draft?.wallIds).toHaveLength(0);
  });

  it('createFreeWall assigns next wall code correctly after existing walls', () => {
    // Insert a pre-existing wall manually to seed code sequence
    const existingWallId = crypto.randomUUID();
    const existingWall = {
      id: existingWallId,
      code: 'W01',
      name: 'Wall 01',
      wallType: 'generic' as const,
      x1: 0, y1: 0, x2: 80, y2: 0,
      blocksRackPlacement: true
    };
    const draft = {
      ...createUuidLayoutDraftFixture(),
      wallIds: [existingWallId],
      walls: { [existingWallId]: existingWall }
    };
    useEditorStore.getState().initializeDraft(draft);

    useEditorStore.getState().createFreeWall(0, 80, 120, 80);

    const newWallId = useEditorStore.getState().draft?.wallIds[1] ?? null;
    expect(newWallId).toBeTruthy();
    expect(useEditorStore.getState().draft?.walls[newWallId!]?.code).toBe('W02');
  });

  it('createFreeWall exits draw-wall mode back to select after creation', () => {
    const draft = createUuidLayoutDraftFixture();
    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().setEditorMode('draw-wall');
    expect(useModeStore.getState().editorMode).toBe('draw-wall');

    useEditorStore.getState().createFreeWall(0, 0, 120, 0);

    expect(useModeStore.getState().editorMode).toBe('select');
  });

  it('createFreeWall grid-snaps input coordinates before building the wall', () => {
    const draft = createUuidLayoutDraftFixture();
    useEditorStore.getState().initializeDraft(draft);

    // Slightly off-grid inputs (metres); expect snapping to nearest 1 m grid cell
    useEditorStore.getState().createFreeWall(3.4, 7.1, 123.4, 7.6);

    const wallId = useEditorStore.getState().draft?.wallIds[0] ?? null;
    const wall = useEditorStore.getState().draft?.walls[wallId!];
    // x1: 3.4 → 3, y1: 7.1 → 7, x2: 123.4 → 123, y2 axis-locked → 7
    expect(wall).toEqual(
      expect.objectContaining({ x1: 3, y1: 7, x2: 123, y2: 7 })
    );
  });

  it('preserves faceLength when initializing and saving an unchanged draft', () => {
    const draft = createLayoutDraftFixture();
    draft.racks[draft.rackIds[0]].faces[0].faceLength = 4.5;

    useEditorStore.getState().initializeDraft(draft);

    expect(useEditorStore.getState().draft?.racks[draft.rackIds[0]].faces[0].faceLength).toBe(4.5);
    expect(mapLayoutDraftToSavePayload(useEditorStore.getState().draft!).racks[0]?.faces[0].faceLength).toBe(4.5);
  });

  it('resetDraft clears selected rack and dirty state', () => {
    const draft = createLayoutDraftFixture();
    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().updateRackPosition(draft.rackIds[0], 100, 200);

    useEditorStore.getState().resetDraft();

    expect(useEditorStore.getState().draft).toBeNull();
    expect(useInteractionStore.getState().selection).toEqual({ type: 'none' });
    expect(useEditorStore.getState().isDraftDirty).toBe(false);
    expect(useInteractionStore.getState().contextPanelMode).toBe('compact');
  });

  it('resetDraft resets mode-store to layout/select and cancels any active workflow', () => {
    useEditorStore.getState().setViewMode('storage');
    useEditorStore.getState().startPlaceContainerWorkflow('cell-1');
    expect(useModeStore.getState().viewMode).toBe('storage');
    expect(useEditorStore.getState().activeStorageWorkflow).not.toBeNull();

    useEditorStore.getState().resetDraft();

    expect(useModeStore.getState().viewMode).toBe('layout');
    expect(useModeStore.getState().editorMode).toBe('select');
    expect(useEditorStore.getState().activeStorageWorkflow).toBeNull();
  });

  it('createRack starts an explicit rack_creation task for the new rack', () => {
    useEditorStore.getState().initializeDraft(createUuidLayoutDraftFixture());

    useEditorStore.getState().createRack(120, 80);

    const rackId = useEditorStore.getState().draft?.rackIds[0] ?? null;
    expect(rackId).toBeTruthy();
    expect(useEditorStore.getState().activeTask).toEqual({
      type: 'rack_creation',
      rackId
    });
  });

  it('deleteRack clears activeTask when deleting the active task rack', () => {
    useEditorStore.getState().initializeDraft(createUuidLayoutDraftFixture());
    useEditorStore.getState().createRack(120, 80);

    const rackId = useEditorStore.getState().draft?.rackIds[0] ?? null;
    expect(rackId).toBeTruthy();

    useEditorStore.getState().deleteRack(rackId!);

    expect(useEditorStore.getState().activeTask).toBeNull();
  });

  describe('setViewMode — cross-store coordination invariants', () => {
    it('resets editorMode to select, clears selection/highlights, clears activeTask, and cancels workflow', () => {
      // Arrange: layout mode with an active draw tool, rack selected, stale workflow
      useModeStore.setState({ viewMode: 'layout', editorMode: 'draw-wall' });
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        selection: { type: 'rack', rackIds: ['r1'], focus: { type: 'body' } },
        highlightedCellIds: ['cell-1', 'cell-2']
      });
      useEditorStore.setState({
        ...useEditorStore.getState(),
        activeTask: { type: 'rack_creation', rackId: 'r1' },
        activeStorageWorkflow: { kind: 'place-container', cellId: 'cell-1', status: 'editing', errorMessage: null }
      });

      useEditorStore.getState().setViewMode('storage');

      // All three stores must be in sync
      expect(useModeStore.getState().viewMode).toBe('storage');
      expect(useModeStore.getState().editorMode).toBe('select');
      expect(useInteractionStore.getState().selection).toEqual({ type: 'none' });
      expect(useInteractionStore.getState().highlightedCellIds).toEqual([]);
      expect(useEditorStore.getState().activeTask).toBeNull();
      expect(useEditorStore.getState().activeStorageWorkflow).toBeNull();
    });

    it('storage→layout transition cancels active storage workflow and clears cell selection', () => {
      useEditorStore.getState().setViewMode('storage');
      useEditorStore.getState().startPlaceContainerWorkflow('cell-abc');
      expect(useEditorStore.getState().activeStorageWorkflow).not.toBeNull();
      expect(useInteractionStore.getState().selection).toEqual({ type: 'cell', cellId: 'cell-abc' });

      useEditorStore.getState().setViewMode('layout');

      expect(useModeStore.getState().viewMode).toBe('layout');
      expect(useModeStore.getState().editorMode).toBe('select');
      expect(useEditorStore.getState().activeStorageWorkflow).toBeNull();
      expect(useInteractionStore.getState().selection).toEqual({ type: 'none' });
    });

    it('setViewMode to the current mode still resets editorMode and selection', () => {
      // Repeated call (e.g. UI re-applies same mode) must still enforce clean state
      useModeStore.setState({ viewMode: 'layout', editorMode: 'place' });
      useInteractionStore.setState({
        ...useInteractionStore.getState(),
        selection: { type: 'rack', rackIds: ['r1'], focus: { type: 'body' } }
      });

      useEditorStore.getState().setViewMode('layout');

      expect(useModeStore.getState().editorMode).toBe('select');
      expect(useInteractionStore.getState().selection).toEqual({ type: 'none' });
    });

    it('storage workflow is a no-op when startPlaceContainerWorkflow is called outside storage mode', () => {
      // viewMode defaults to 'layout' after reset
      expect(useModeStore.getState().viewMode).toBe('layout');
      useEditorStore.getState().startPlaceContainerWorkflow('cell-1');

      expect(useEditorStore.getState().activeStorageWorkflow).toBeNull();
    });

    it('storage workflow is a no-op when startPlacementMove is called outside storage mode', () => {
      expect(useModeStore.getState().viewMode).toBe('layout');
      useEditorStore.getState().startPlacementMove('container-1', 'cell-1');

      expect(useEditorStore.getState().activeStorageWorkflow).toBeNull();
    });
  });

  it('stores Context Panel shell mode as in-session editor state', () => {
    expect(useInteractionStore.getState().contextPanelMode).toBe('compact');

    useInteractionStore.getState().setContextPanelMode('expanded');
    expect(useInteractionStore.getState().contextPanelMode).toBe('expanded');

    useInteractionStore.getState().toggleContextPanelMode();
    expect(useInteractionStore.getState().contextPanelMode).toBe('compact');
  });

  it('stores created-container details when create-and-place enters placement retry', () => {
    useEditorStore.getState().setViewMode('storage');
    useEditorStore.getState().startCreateAndPlaceWorkflow('cell-1');

    useEditorStore.getState().setCreateAndPlacePlacementRetry(
      { id: 'container-1', code: 'CNT-000123' },
      'Container created, but placement failed. CNT-000123 remains unplaced. Target location is full.'
    );

    expect(useEditorStore.getState().activeStorageWorkflow).toEqual({
      kind: 'create-and-place',
      cellId: 'cell-1',
      status: 'placement-retry',
      errorMessage:
        'Container created, but placement failed. CNT-000123 remains unplaced. Target location is full.',
      createdContainer: {
        id: 'container-1',
        code: 'CNT-000123'
      }
    });
  });

  it('clears stale workflow errors when a submit starts', () => {
    useEditorStore.getState().setViewMode('storage');
    useEditorStore.getState().startPlaceContainerWorkflow('cell-1');
    useEditorStore
      .getState()
      .setActiveStorageWorkflowError('Could not place the container.');

    useEditorStore.getState().markActiveStorageWorkflowSubmitting();

    expect(useEditorStore.getState().activeStorageWorkflow).toEqual({
      kind: 'place-container',
      cellId: 'cell-1',
      status: 'submitting',
      errorMessage: null
    });
  });

  it('preserves placement-retry created-container details while clearing stale errors', () => {
    useEditorStore.getState().setViewMode('storage');
    useEditorStore.getState().startCreateAndPlaceWorkflow('cell-1');
    useEditorStore.getState().setCreateAndPlacePlacementRetry(
      { id: 'container-1', code: 'CNT-000123' },
      'Container created, but placement failed. CNT-000123 remains unplaced. Target location is full.'
    );

    useEditorStore.getState().markActiveStorageWorkflowSubmitting();

    expect(useEditorStore.getState().activeStorageWorkflow).toEqual({
      kind: 'create-and-place',
      cellId: 'cell-1',
      status: 'submitting',
      errorMessage: null,
      createdContainer: {
        id: 'container-1',
        code: 'CNT-000123'
      }
    });

    useEditorStore
      .getState()
      .setActiveStorageWorkflowError('Placement failed again.');

    expect(useEditorStore.getState().activeStorageWorkflow).toEqual({
      kind: 'create-and-place',
      cellId: 'cell-1',
      status: 'error',
      errorMessage: 'Placement failed again.',
      createdContainer: {
        id: 'container-1',
        code: 'CNT-000123'
      }
    });

    useEditorStore.getState().setActiveStorageWorkflowError(null);

    expect(useEditorStore.getState().activeStorageWorkflow).toEqual({
      kind: 'create-and-place',
      cellId: 'cell-1',
      status: 'placement-retry',
      errorMessage: null,
      createdContainer: {
        id: 'container-1',
        code: 'CNT-000123'
      }
    });
  });

  it('clears stale workflow errors and created-container details when a new create-and-place workflow starts', () => {
    useEditorStore.getState().setViewMode('storage');
    useEditorStore.getState().startCreateAndPlaceWorkflow('cell-1');
    useEditorStore.getState().setCreateAndPlacePlacementRetry(
      { id: 'container-1', code: 'CNT-000123' },
      'Container created, but placement failed. CNT-000123 remains unplaced. Target location is full.'
    );

    useEditorStore.getState().startCreateAndPlaceWorkflow('cell-2');

    expect(useEditorStore.getState().activeStorageWorkflow).toEqual({
      kind: 'create-and-place',
      cellId: 'cell-2',
      status: 'editing',
      errorMessage: null,
      createdContainer: null
    });
  });

  it('clears move-container stale errors when the target cell changes', () => {
    useEditorStore.getState().setViewMode('storage');
    useEditorStore.getState().startPlacementMove('container-1', 'cell-1');
    useEditorStore
      .getState()
      .setActiveStorageWorkflowError('Could not move the container.');

    useEditorStore.getState().setPlacementMoveTargetCellId('cell-2');

    expect(useEditorStore.getState().activeStorageWorkflow).toEqual({
      kind: 'move-container',
      containerId: 'container-1',
      sourceCellId: 'cell-1',
      targetCellId: 'cell-2',
      status: 'targeting',
      errorMessage: null
    });
  });

  it('generates UUID ids for all new entities sent to save', () => {
    useEditorStore.getState().initializeDraft(createUuidLayoutDraftFixture());
    useEditorStore.getState().createRack(120, 80);

    const rackId = useEditorStore.getState().draft?.rackIds[0];
    expect(rackId).toBeTruthy();

    const sectionId = useEditorStore.getState().draft?.racks[rackId!].faces[0]?.sections[0]?.id;
    expect(sectionId).toBeTruthy();

    useEditorStore.getState().addSection(rackId!, 'A');
    useEditorStore.getState().addLevel(rackId!, 'A', sectionId!);
    useEditorStore.getState().updateLevelCount(rackId!, 'A', sectionId!, 3);
    useEditorStore.getState().applyFacePreset(rackId!, 'A', 2, 2, 4);
    useEditorStore.getState().setFaceBMode(rackId!, 'copy');
    useEditorStore.getState().duplicateRack(rackId!);

    const payload = mapLayoutDraftToSavePayload(useEditorStore.getState().draft!);

    expect(payload.layoutVersionId).toMatch(UUID_REGEX);

    for (const rack of payload.racks) {
      expect(rack.id).toMatch(UUID_REGEX);

      for (const face of rack.faces) {
        expect(face.id).toMatch(UUID_REGEX);
        expect(face.mirrorSourceFaceId === null || UUID_REGEX.test(face.mirrorSourceFaceId)).toBe(true);

        for (const section of face.sections) {
          expect(section.id).toMatch(UUID_REGEX);

          for (const level of section.levels) {
            expect(level.id).toMatch(UUID_REGEX);
          }
        }
      }
    }
  });

  it('normalizes stale invalid drafts on initialize and marks them dirty', () => {
    const draft = createLayoutDraftFixture();
    draft.racks[draft.rackIds[0]].faces[0].sections[0].length = 2.5;
    draft.racks[draft.rackIds[0]].faces[1].enabled = true;
    draft.racks[draft.rackIds[0]].faces[1].sections = [
      {
        id: 'section-b-1',
        ordinal: 1,
        length: 2.5,
        levels: [{ id: 'level-b-1', ordinal: 1, slotCount: 3 }]
      }
    ];

    useEditorStore.getState().initializeDraft(draft);

    const normalizedDraft = useEditorStore.getState().draft!;
    expect(normalizedDraft.racks[draft.rackIds[0]].faces[0].sections[0].length).toBe(5);
    expect(normalizedDraft.racks[draft.rackIds[0]].faces[1].enabled).toBe(false);
    expect(normalizedDraft.racks[draft.rackIds[0]].faces[1].sections).toEqual([]);
    expect(useEditorStore.getState().isDraftDirty).toBe(true);
  });

  it('rescales sections when total rack length changes', () => {
    const draft = createLayoutDraftFixture();
    useEditorStore.getState().initializeDraft(draft);

    useEditorStore.getState().updateRackGeneral(draft.rackIds[0], { totalLength: 10 });

    expect(useEditorStore.getState().draft?.racks[draft.rackIds[0]].faces[0].sections[0].length).toBe(10);
  });

  it('resets Face B when rack kind switches to single', () => {
    const draft = createLayoutDraftFixture();
    draft.racks[draft.rackIds[0]].kind = 'paired';
    draft.racks[draft.rackIds[0]].faces[1].enabled = true;
    draft.racks[draft.rackIds[0]].faces[1].sections = [
      {
        id: 'section-b-1',
        ordinal: 1,
        length: 5,
        levels: [{ id: 'level-b-1', ordinal: 1, slotCount: 3 }]
      }
    ];

    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().updateRackGeneral(draft.rackIds[0], { kind: 'single' });

    const faceB = useEditorStore.getState().draft?.racks[draft.rackIds[0]].faces[1];
    expect(faceB?.enabled).toBe(false);
    expect(faceB?.isMirrored).toBe(false);
    expect(faceB?.mirrorSourceFaceId).toBeNull();
    expect(faceB?.sections).toEqual([]);
  });
});
