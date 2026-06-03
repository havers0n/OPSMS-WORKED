// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAddInventoryToContainer } from './use-add-inventory-to-container';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const mockInvalidateContainerInventoryQueries = vi.fn();
const mockAddInventoryToContainer = vi.fn();

vi.mock('./invalidation', () => ({
  invalidateContainerInventoryQueries: (...args: unknown[]) =>
    mockInvalidateContainerInventoryQueries(...args)
}));

vi.mock('../api/mutations', () => ({
  addInventoryToContainer: (...args: unknown[]) => mockAddInventoryToContainer(...args)
}));

const mockUseMutation = vi.fn();
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useMutation: (opts: {
      mutationFn: (input: unknown) => Promise<unknown>;
      onSuccess?: (result: unknown, vars: unknown, context: unknown) => Promise<unknown> | unknown;
    }) => {
      mockUseMutation(opts);
      return {
        isPending: false,
        mutateAsync: async (input: unknown) => {
          const result = await opts.mutationFn(input);
          await opts.onSuccess?.(result, input, undefined);
          return result;
        }
      };
    },
    useQueryClient: () => ({ invalidateQueries: vi.fn() })
  };
});

function withCryptoMethodOverride<K extends 'randomUUID' | 'getRandomValues'>(
  key: K,
  value: Crypto[K] | undefined
) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis.crypto, key);
  Object.defineProperty(globalThis.crypto, key, {
    value,
    configurable: true
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(globalThis.crypto, key, descriptor);
      return;
    }

    delete (globalThis.crypto as Crypto & Record<string, unknown>)[key];
  };
}

describe('useAddInventoryToContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddInventoryToContainer.mockResolvedValue({ id: 'inventory-item-1' });
  });

  it('submits a valid UUID when randomUUID is unavailable', async () => {
    const restoreRandomUUID = withCryptoMethodOverride('randomUUID', undefined);
    const restoreGetRandomValues = withCryptoMethodOverride('getRandomValues', <T extends ArrayBufferView>(array: T) => {
      if (array instanceof Uint8Array) {
        for (let i = 0; i < array.length; i += 1) {
          array[i] = i;
        }
      }
      return array;
    });

    try {
      const { result } = renderHook(() =>
        useAddInventoryToContainer({
          floorId: 'floor-uuid',
          sourceCellId: 'cell-uuid',
          containerId: 'container-uuid'
        })
      );

      await result.current.mutateAsync({
        containerId: 'container-uuid',
        productId: 'product-uuid',
        quantity: 100,
        uom: 'pcs'
      });

      expect(mockAddInventoryToContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          containerId: 'container-uuid',
          productId: 'product-uuid',
          quantity: 100,
          uom: 'pcs',
          receiptCorrelationKey: expect.stringMatching(UUID_V4_REGEX)
        })
      );
    } finally {
      restoreRandomUUID();
      restoreGetRandomValues();
    }
  });
});
