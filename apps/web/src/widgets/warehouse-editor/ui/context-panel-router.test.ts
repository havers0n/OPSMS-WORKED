import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContextPanelIntent } from './context-panel-logic';
import type { ViewMode } from '@/widgets/warehouse-editor/model/editor-types';
import { ContextPanel } from './context-panel';

let mockViewMode: ViewMode = 'storage';
let mockIntent: ContextPanelIntent = 'hidden';
let mockContextPanelMode: 'compact' | 'expanded' = 'compact';
const mockToggleContextPanelMode = vi.fn();

vi.mock('./context-panel-logic', () => ({
  resolveContextPanelIntent: () => mockIntent
}));

vi.mock('@/widgets/warehouse-editor/model/editor-selectors', async () => {
  const actual = await vi.importActual<typeof import('@/widgets/warehouse-editor/model/editor-selectors')>(
    '@/widgets/warehouse-editor/model/editor-selectors'
  );

  return {
    ...actual,
    useInteractionScope: () => 'object' as const,
    useEditorMode: () => 'select' as const,
    useViewMode: () => mockViewMode,
    useEditorSelection: () => ({ type: 'none' } as const),
    useContextPanelMode: () => mockContextPanelMode,
    useToggleContextPanelMode: () => mockToggleContextPanelMode
  };
});

vi.mock('./context-panel/layout-context-panel', () => ({
  LayoutContextPanel: ({ intent, viewMode }: { intent: ContextPanelIntent; viewMode: ViewMode }) =>
    intent === 'rack-context' && viewMode === 'layout'
      ? React.createElement('div', { 'data-testid': 'layout-context-owner' }, 'layout-context-owner')
      : null
}));

vi.mock('./context-panel/storage-context-panel', () => ({
  StorageContextPanel: ({ intent, viewMode }: { intent: ContextPanelIntent; viewMode: ViewMode }) =>
    intent === 'workflow' && viewMode === 'storage'
      ? React.createElement('div', { 'data-testid': 'storage-context-owner' }, 'storage-context-owner')
      : null
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
  mockViewMode = 'storage';
  mockIntent = 'hidden';
  mockContextPanelMode = 'compact';
  mockToggleContextPanelMode.mockReset();
});

describe('ContextPanel shell routing', () => {
  it('routes rack-context in layout mode to the layout owner', () => {
    mockIntent = 'rack-context';
    mockViewMode = 'layout';

    const renderer = renderContextPanel();

    expect(renderer.root.findAllByProps({ 'data-testid': 'layout-context-owner' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-context-owner' })).toHaveLength(0);
  });

  it('routes workflow in storage mode to the storage owner', () => {
    mockIntent = 'workflow';
    mockViewMode = 'storage';

    const renderer = renderContextPanel();

    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-context-owner' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-testid': 'layout-context-owner' })).toHaveLength(0);
  });

  it('keeps fallback parity for unsupported intent/viewMode combinations', () => {
    mockIntent = 'workflow';
    mockViewMode = 'view';

    const renderer = renderContextPanel();

    expect(renderer.root.findAllByProps({ 'data-testid': 'layout-context-owner' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-testid': 'storage-context-owner' })).toHaveLength(0);
    expect(hasText(renderer, 'Workflow state and progress will appear here.')).toBe(true);
  });

  it('keeps expand toggle visible only for cell/workflow intents', () => {
    mockIntent = 'workflow';
    mockViewMode = 'storage';

    const workflowRenderer = renderContextPanel();
    expect(workflowRenderer.root.findAllByProps({ title: 'Expand context panel' })).toHaveLength(1);

    mockIntent = 'container-context';
    const containerRenderer = renderContextPanel();
    expect(containerRenderer.root.findAllByProps({ title: 'Expand context panel' })).toHaveLength(0);
  });
});
