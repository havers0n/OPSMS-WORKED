import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLayoutDraftFixture } from '@/widgets/warehouse-editor/model/__fixtures__/layout-draft.fixture';
import { useEditorStore } from '@/widgets/warehouse-editor/model/editor-store';
import { useInteractionStore } from '@/widgets/warehouse-editor/model/interaction-store';
import { useModeStore } from '@/widgets/warehouse-editor/model/mode-store';
import { resetStorageFocusStore, useStorageFocusStore } from '@/widgets/warehouse-editor/model/v2/storage-focus-store';
import { BffRequestError } from '@/shared/api/bff/client';
import { TopBar } from './top-bar';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

type ValidationResult = {
  isValid: boolean;
  issues: Array<{ severity: 'error' | 'warning'; message: string }>;
};

const mockValidateMutateAsync = vi.fn();
const mockPublishMutateAsync = vi.fn();
let mockPublishedCellsQuery: { data: Array<{ id: string; rackId: string; address: { raw: string; parts: { level: number } } }>; isLoading: boolean; isError: boolean } = {
  data: [],
  isLoading: false,
  isError: false
};

let mockValidationState: {
  cachedResult: ValidationResult | null;
  isPending: boolean;
} = {
  cachedResult: null,
  isPending: false
};

vi.mock('@/app/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { email: 'admin@wos.local' },
    memberships: [{ tenantId: 'tenant-1', role: 'admin' }],
    currentTenantId: 'tenant-1',
    signOut: vi.fn()
  })
}));

vi.mock('@/app/store/ui-selectors', () => ({
  useActiveFloorId: () => 'floor-1',
  useActiveSiteId: () => 'site-1',
  useIsDrawerCollapsed: () => false,
  useSetActiveFloorId: () => vi.fn(),
  useSetActiveSiteId: () => vi.fn(),
  useToggleDrawer: () => vi.fn()
}));

vi.mock('@/entities/floor/api/use-floors', () => ({
  useFloors: () => ({
    data: [{ id: 'floor-1', code: 'F1', name: 'Main Floor' }]
  })
}));

vi.mock('@/entities/site/api/use-sites', () => ({
  useSites: () => ({
    data: [{ id: 'site-1', code: 'SITE', name: 'Main Site' }]
  })
}));

vi.mock('@/entities/layout-version/api/use-floor-workspace', () => ({
  useFloorWorkspace: () => ({
    data: {
      floorId: 'floor-1',
      activeDraft: createLayoutDraftFixture(),
      latestPublished: null
    },
    isLoading: false,
    isError: false
  })
}));

vi.mock('@/entities/cell/api/use-published-cells', () => ({
  usePublishedCells: () => mockPublishedCellsQuery
}));

vi.mock('@/features/layout-draft-save/model/use-create-layout-draft', () => ({
  useCreateLayoutDraft: () => ({
    isPending: false,
    mutateAsync: vi.fn()
  })
}));

vi.mock('@/features/layout-draft-save/model/use-save-layout-draft', () => ({
  useSaveLayoutDraft: () => ({
    isPending: false,
    flushSave: vi.fn(),
    mutateAsync: vi.fn()
  })
}));

vi.mock('@/features/layout-publish/model/use-publish-layout', () => ({
  usePublishLayout: () => ({
    isPending: false,
    mutateAsync: mockPublishMutateAsync
  })
}));

vi.mock('@/features/layout-validate/model/use-layout-validation', () => ({
  useLayoutValidation: () => ({
    cachedResult: mockValidationState.cachedResult,
    isPending: mockValidationState.isPending,
    mutateAsync: mockValidateMutateAsync
  })
}));

function resetStores() {
  resetStorageFocusStore();
  useModeStore.setState({
    viewMode: 'layout',
    editorMode: 'select'
  });
  useInteractionStore.setState({
    selection: { type: 'none' },
    hoveredRackId: null,
    highlightedCellIds: [],
    contextPanelMode: 'compact'
  });
  useEditorStore.setState({
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
}

function collectText(node: TestRenderer.ReactTestRendererJSON | TestRenderer.ReactTestRendererJSON[] | null): string {
  if (node === null) return '';
  if (Array.isArray(node)) {
    return node.map((child) => collectText(child)).join(' ');
  }

  return (node.children ?? [])
    .map((child) => (typeof child === 'string' ? child : collectText(child)))
    .join(' ');
}

function setPathname(pathname: string) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: { pathname }
    }
  });
}

async function submitLocate(renderer: TestRenderer.ReactTestRenderer, value: string) {
  const input = renderer.root.findByProps({ 'aria-label': 'Locate cell address' });
  const locateForm = renderer.root
    .findAll((instance) => instance.type === 'form')
    .find((form) => form.findAllByProps({ 'aria-label': 'Locate cell address' }).length > 0);

  if (!locateForm) throw new Error('Locate form was not found');

  await act(async () => {
    input.props.onChange({ target: { value } });
  });

  await act(async () => {
    locateForm.props.onSubmit({ preventDefault: () => undefined });
  });
}

describe('TopBar lifecycle wording', () => {
  beforeEach(() => {
    resetStores();
    setPathname('/operations');
    mockValidationState = {
      cachedResult: null,
      isPending: false
    };
    mockPublishedCellsQuery = {
      data: [],
      isLoading: false,
      isError: false
    };
    mockValidateMutateAsync.mockReset();
    mockPublishMutateAsync.mockReset();
  });

  it('shows Draft changed instead of cached validation verdict for dirty drafts', async () => {
    const draft = createLayoutDraftFixture();
    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.getState().updateRackPosition(draft.rackIds[0], 180, 300);
    mockValidationState.cachedResult = {
      isValid: true,
      issues: []
    };

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(createElement(TopBar));
    });
    const text = collectText(renderer.toJSON());

    expect(text).toContain('Unsaved');
    expect(text).toContain('Draft changed');
    expect(text).not.toContain('Valid');
  });

  it('clears stale validate success copy after a new edit makes the draft dirty', async () => {
    const draft = createLayoutDraftFixture();
    useEditorStore.getState().initializeDraft(draft);
    mockValidationState.cachedResult = {
      isValid: true,
      issues: []
    };
    mockValidateMutateAsync.mockResolvedValue({
      isValid: true,
      issues: []
    });

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(createElement(TopBar));
    });

    const validateButton = renderer.root.find(
      (instance) => instance.type === 'button' && instance.props.title === 'Validate layout'
    );

    await act(async () => {
      await validateButton.props.onClick();
    });

    expect(collectText(renderer.toJSON())).toContain('Valid');

    await act(async () => {
      useEditorStore.getState().updateRackPosition(draft.rackIds[0], 220, 340);
    });

    const textAfterEdit = collectText(renderer.toJSON());

    expect(textAfterEdit).toContain('Unsaved');
    expect(textAfterEdit).toContain('Draft changed');
    expect(textAfterEdit).not.toContain('Valid');
  });

  it('shows persisted validation follow-up after publish gate failure instead of a generic save error', async () => {
    const draft = createLayoutDraftFixture();
    useEditorStore.getState().initializeDraft(draft);
    mockPublishMutateAsync.mockRejectedValue(
      new BffRequestError(
        409,
        'LAYOUT_VALIDATION_FAILED',
        'Layout draft failed validation. Please review the reported issues.',
        null,
        null
      )
    );
    mockValidateMutateAsync.mockResolvedValue({
      isValid: false,
      issues: [
        {
          severity: 'error',
          message: 'Rack R-01 has overlapping cells.'
        }
      ]
    });

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(createElement(TopBar));
    });

    const publishButton = renderer.root.find(
      (instance) =>
        instance.type === 'button' &&
        Array.isArray(instance.props.children) &&
        instance.props.children.includes('Publish')
    );

    await act(async () => {
      await publishButton.props.onClick();
    });

    const text = collectText(renderer.toJSON());

    expect(text).toContain('Rack R-01 has overlapping cells.');
    expect(text).not.toContain('Save failed');
  });

  it('routes storage-mode locate through StorageFocusStore with coherent level/rack state', async () => {
    useModeStore.setState({ viewMode: 'storage', editorMode: 'select' });
    setPathname('/warehouse');
    mockPublishedCellsQuery = {
      data: [
        {
          id: 'cell-storage-1',
          rackId: 'rack-storage-1',
          address: { raw: 'A-01-03-07', parts: { level: 3 } }
        }
      ],
      isLoading: false,
      isError: false
    };

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(createElement(TopBar));
    });

    await submitLocate(renderer, 'a010307');

    expect(useStorageFocusStore.getState()).toMatchObject({
      selectedCellId: 'cell-storage-1',
      selectedRackId: 'rack-storage-1',
      activeLevel: 3
    });
    expect(useInteractionStore.getState().selection).toEqual({ type: 'none' });
    expect(useInteractionStore.getState().highlightedCellIds).toEqual(['cell-storage-1']);
  });

  it('keeps non-storage locate behavior unchanged (legacy selection + highlight)', async () => {
    useModeStore.setState({ viewMode: 'view', editorMode: 'select' });
    setPathname('/warehouse');
    mockPublishedCellsQuery = {
      data: [
        {
          id: 'cell-view-1',
          rackId: 'rack-view-1',
          address: { raw: 'B-02-01-04', parts: { level: 1 } }
        }
      ],
      isLoading: false,
      isError: false
    };

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(createElement(TopBar));
    });

    await submitLocate(renderer, 'b020104');

    expect(useInteractionStore.getState().selection).toEqual({ type: 'cell', cellId: 'cell-view-1' });
    expect(useInteractionStore.getState().highlightedCellIds).toEqual(['cell-view-1']);
    expect(useStorageFocusStore.getState()).toMatchObject({
      selectedCellId: null,
      selectedRackId: null,
      activeLevel: null
    });
  });
});
