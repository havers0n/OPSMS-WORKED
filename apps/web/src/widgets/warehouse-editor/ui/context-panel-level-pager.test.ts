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

vi.mock('@/widgets/warehouse-editor/model/editor-selectors', async () => {
  const actual = await vi.importActual<typeof import('@/widgets/warehouse-editor/model/editor-selectors')>(
    '@/widgets/warehouse-editor/model/editor-selectors'
  );

  return {
    ...actual,
    useInteractionScope: () => 'object' as const,
    useEditorMode: () => 'select' as const,
    useViewMode: () => mockViewMode,
    useEditorSelection: () => ({ type: 'rack', rackIds: mockSelectedRackId ? [mockSelectedRackId] : [] }),
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
});

describe('ContextPanel rack-level ownership', () => {
  it('suppresses legacy storage rack-level panel content in storage mode', () => {
    const renderer = renderContextPanel();

    expect(hasText(renderer, 'Rack-level storage ownership is in the inspector.')).toBe(true);
    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-context-level-pager' })).toHaveLength(0);
  });

  it('keeps non-storage rack-context branch available in view mode', () => {
    mockViewMode = 'view';
    const renderer = renderContextPanel();

    expect(hasText(renderer, 'Rack-level storage overview is available in Storage mode.')).toBe(true);
  });
});
