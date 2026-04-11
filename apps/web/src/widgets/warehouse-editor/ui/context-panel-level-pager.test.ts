import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LayoutDraft } from '@wos/domain';
import { createLayoutDraftFixture } from '../model/__fixtures__/layout-draft.fixture';
import type { ViewMode } from '@/widgets/warehouse-editor/model/editor-types';
import { ContextPanel } from './context-panel';

let mockViewMode: ViewMode = 'storage';
let mockLayoutDraft: LayoutDraft | null = null;
let mockSelectedRackId: string | null = null;
let mockInteractionScope: 'idle' | 'object' | 'workflow' = 'object';
let mockSelection:
  | { type: 'none' }
  | { type: 'rack'; rackIds: string[] }
  | { type: 'cell'; cellId: string } = { type: 'none' };

vi.mock('@/widgets/warehouse-editor/model/editor-selectors', async () => {
  const actual = await vi.importActual<typeof import('@/widgets/warehouse-editor/model/editor-selectors')>(
    '@/widgets/warehouse-editor/model/editor-selectors'
  );

  return {
    ...actual,
    useInteractionScope: () => mockInteractionScope,
    useEditorMode: () => 'select' as const,
    useViewMode: () => mockViewMode,
    useEditorSelection: () => mockSelection,
    useContextPanelMode: () => 'compact' as const,
    useToggleContextPanelMode: () => () => undefined,
    useSelectedRackId: () => mockSelectedRackId
  };
});

vi.mock('../lib/use-workspace-layout', () => ({
  useWorkspaceLayout: () => mockLayoutDraft
}));

vi.mock('@/features/layout-validate/model/use-layout-validation', () => ({
  useCachedLayoutValidation: () => ({ data: null })
}));

vi.mock('./mode-panels/storage-workflow-context-panel', () => ({
  StorageWorkflowContextPanel: () => React.createElement('div', { 'data-testid': 'storage-workflow-context-owner' }, 'storage-workflow-context-owner')
}));
vi.mock('./mode-panels/storage-cell-context-panel', () => ({
  StorageCellContextPanel: () => React.createElement('div', { 'data-testid': 'storage-cell-context-launcher' }, 'storage-cell-context-launcher')
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderContextPanel() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      React.createElement(ContextPanel, { workspace: null, onOpenInspector: () => undefined })
    );
  });
  return renderer;
}

function hasText(renderer: TestRenderer.ReactTestRenderer, text: string) {
  return JSON.stringify(renderer.toJSON()).includes(text);
}

beforeEach(() => {
  mockLayoutDraft = createLayoutDraftFixture();
  mockSelectedRackId = mockLayoutDraft.rackIds[0];
  mockViewMode = 'storage';
  mockInteractionScope = 'object';
  mockSelection = { type: 'rack', rackIds: mockSelectedRackId ? [mockSelectedRackId] : [] };
});

function setFaceALevelCount(draft: LayoutDraft, levelCount: number) {
  const rackId = draft.rackIds[0];
  const faceA = draft.racks[rackId]?.faces.find((face) => face.side === 'A');
  if (faceA && faceA.sections[0]) {
    faceA.sections[0].levels = Array.from({ length: levelCount }, (_, index) => ({
      id: `level-a-${index + 1}`,
      ordinal: index + 1,
      slotCount: 3
    }));
  }
}

describe('ContextPanel rack-level ownership', () => {
  it('preserves current contract: storage mode keeps rack-level pager ownership in inspector, not context panel', () => {
    const renderer = renderContextPanel();

    expect(hasText(renderer, 'Rack-level storage ownership is in the inspector.')).toBe(true);
    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-context-level-pager' })).toHaveLength(0);
  });

  it('preserves current contract: storage mode still does not render context rack-level pager even when rack has multiple levels', () => {
    setFaceALevelCount(mockLayoutDraft as LayoutDraft, 4);
    const renderer = renderContextPanel();

    expect(hasText(renderer, 'Rack-level storage ownership is in the inspector.')).toBe(true);
    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-context-level-pager' })).toHaveLength(0);
  });

  it('keeps non-storage rack-context branch available in view mode', () => {
    mockViewMode = 'view';
    const renderer = renderContextPanel();

    expect(hasText(renderer, 'Rack-level storage overview is available in Storage mode.')).toBe(true);
  });

  it('renders storage workflow owner branch in context panel during storage workflow scope', () => {
    mockViewMode = 'storage';
    mockInteractionScope = 'workflow';
    mockSelection = { type: 'cell', cellId: 'cell-1' };
    const renderer = renderContextPanel();

    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-workflow-context-owner' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-cell-context-launcher' })).toHaveLength(0);
  });

  it('keeps launcher branch in object cell scope and does not render workflow owner root', () => {
    mockViewMode = 'storage';
    mockInteractionScope = 'object';
    mockSelection = { type: 'cell', cellId: 'cell-1' };
    const renderer = renderContextPanel();

    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-cell-context-launcher' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-workflow-context-owner' })).toHaveLength(0);
  });

  it('keeps workflow branch non-owner outside storage mode', () => {
    mockViewMode = 'view';
    mockInteractionScope = 'workflow';
    mockSelection = { type: 'cell', cellId: 'cell-1' };
    const renderer = renderContextPanel();

    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-workflow-context-owner' })).toHaveLength(0);
    expect(hasText(renderer, 'Workflow state and progress will appear here.')).toBe(true);
  });
});
