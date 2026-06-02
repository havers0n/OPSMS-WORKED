// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAddInventoryItem } from './use-add-inventory-item';

const mockInvalidatePlacementQueries = vi.fn();
vi.mock('@/features/placement-actions/model/invalidation', () => ({
  invalidatePlacementQueries: (...args: unknown[]) => mockInvalidatePlacementQueries(...args)
}));

const mockUseMutation = vi.fn();
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useMutation: (opts: { mutationFn: unknown; onSuccess: unknown }) => {
      mockUseMutation(opts);
      return { mutateAsync: async (input: unknown) => (opts.onSuccess as (result: unknown, vars: unknown, context: unknown) => Promise<unknown>)(undefined, input, undefined) };
    },
    useQueryClient: () => ({ invalidateQueries: vi.fn() })
  };
});

describe('useAddInventoryItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls invalidatePlacementQueries with containerId on success', async () => {
    const { result } = renderHook(() =>
      useAddInventoryItem({
        floorId: 'floor-uuid',
        sourceCellId: 'cell-uuid',
        containerId: null
      })
    );

    await result.current.mutateAsync({
      containerId: 'container-uuid',
      productId: 'prod-1',
      quantity: 10,
      uom: 'pcs'
    });

    expect(mockInvalidatePlacementQueries).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        floorId: 'floor-uuid',
        sourceCellId: 'cell-uuid',
        containerId: 'container-uuid'
      })
    );
  });

  it('prefers args.containerId over variables.containerId', async () => {
    const { result } = renderHook(() =>
      useAddInventoryItem({
        floorId: 'floor-uuid',
        sourceCellId: 'cell-uuid',
        containerId: 'args-container-uuid'
      })
    );

    await result.current.mutateAsync({
      containerId: 'variables-container-uuid',
      productId: 'prod-1',
      quantity: 5,
      uom: 'pcs'
    });

    expect(mockInvalidatePlacementQueries).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        containerId: 'args-container-uuid'
      })
    );
  });
});
