import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLayoutDraftFixture } from '@/warehouse/editor/model/__fixtures__/layout-draft.fixture';
import {
  warehouseLayoutDraftActions
} from '@/warehouse/state/layout-draft';
import { warehouseInteractionActions } from '@/warehouse/state/interaction';
import { warehouseViewModeActions } from '@/warehouse/state/view-mode';
import { BffRequestError } from '@/shared/api/bff/client';
import { WarehouseTopBar } from './warehouse-top-bar';

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
  warehouseViewModeActions.reset();
  warehouseInteractionActions.resetAll();
  warehouseLayoutDraftActions.resetDraft();
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

describe('TopBar lifecycle wording', () => {
  beforeEach(() => {
    resetStores();
    mockValidationState = {
      cachedResult: null,
      isPending: false
    };
    mockValidateMutateAsync.mockReset();
    mockPublishMutateAsync.mockReset();
  });

  it('shows Draft changed instead of cached validation verdict for dirty drafts', async () => {
    const draft = createLayoutDraftFixture();
    warehouseLayoutDraftActions.initializeDraft(draft);
    warehouseLayoutDraftActions.updateRackPosition(draft.rackIds[0], 180, 300);
    mockValidationState.cachedResult = {
      isValid: true,
      issues: []
    };

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(createElement(WarehouseTopBar));
    });
    const text = collectText(renderer.toJSON());

    expect(text).toContain('Unsaved');
    expect(text).toContain('Draft changed');
    expect(text).not.toContain('Valid');
  });

  it('clears stale validate success copy after a new edit makes the draft dirty', async () => {
    const draft = createLayoutDraftFixture();
    warehouseLayoutDraftActions.initializeDraft(draft);
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
      renderer = TestRenderer.create(createElement(WarehouseTopBar));
    });

    const validateButton = renderer.root.find(
      (instance) => instance.type === 'button' && instance.props.title === 'Validate layout'
    );

    await act(async () => {
      await validateButton.props.onClick();
    });

    expect(collectText(renderer.toJSON())).toContain('Valid');

    await act(async () => {
      warehouseLayoutDraftActions.updateRackPosition(draft.rackIds[0], 220, 340);
    });

    const textAfterEdit = collectText(renderer.toJSON());

    expect(textAfterEdit).toContain('Unsaved');
    expect(textAfterEdit).toContain('Draft changed');
    expect(textAfterEdit).not.toContain('Valid');
  });

  it('shows persisted validation follow-up after publish gate failure instead of a generic save error', async () => {
    const draft = createLayoutDraftFixture();
    warehouseLayoutDraftActions.initializeDraft(draft);
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
      renderer = TestRenderer.create(createElement(WarehouseTopBar));
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
});
