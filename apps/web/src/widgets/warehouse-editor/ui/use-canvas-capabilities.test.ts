import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { useCanvasCapabilities } from './use-canvas-capabilities';

let mockLod: 0 | 1 | 2 = 1;
let mockInteractionLevel: 'L1' | 'L3' = 'L1';

vi.mock('@/widgets/warehouse-editor/model/use-semantic-zoom', () => ({
  useSemanticZoom: () => ({ lod: mockLod, interactionLevel: mockInteractionLevel })
}));

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

type HookResult = ReturnType<typeof useCanvasCapabilities>;

function renderCapabilities(params: { viewMode: 'layout' | 'view' | 'storage' }) {
  let result!: HookResult;

  function Harness() {
    result = useCanvasCapabilities({
      activeStorageWorkflow: null,
      editorMode: 'select',
      isLayoutEditable: true,
      viewMode: params.viewMode
    });
    return null;
  }

  act(() => {
    TestRenderer.create(createElement(Harness));
  });

  return result;
}

describe('useCanvasCapabilities storage rack-first gating', () => {
  it('allows rack selection in storage mode even at L3 depth', () => {
    mockLod = 2;
    mockInteractionLevel = 'L3';

    const result = renderCapabilities({ viewMode: 'storage' });
    expect(result.canSelectRack).toBe(true);
    expect(result.canSelectCells).toBe(true);
  });

  it('keeps view mode rack selection gated to L1', () => {
    mockLod = 2;
    mockInteractionLevel = 'L3';

    const result = renderCapabilities({ viewMode: 'view' });
    expect(result.canSelectRack).toBe(false);
    expect(result.canSelectCells).toBe(true);
  });
});
