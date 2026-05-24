import { afterEach, describe, expect, it, vi } from 'vitest';
import { newEntityId } from './editor-store-helpers';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('newEntityId', () => {
  it('uses crypto.randomUUID when available', () => {
    const expected = '11111111-1111-4111-8111-111111111111';
    const randomUuidMock = vi.fn(() => expected);
    const restoreRandomUUID = withCryptoMethodOverride('randomUUID', randomUuidMock);
    const restoreGetRandomValues = withCryptoMethodOverride(
      'getRandomValues',
      vi.fn((array: Uint8Array) => array)
    );

    try {
      expect(newEntityId()).toBe(expected);
      expect(randomUuidMock).toHaveBeenCalledTimes(1);
      expect((globalThis.crypto.getRandomValues as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    } finally {
      restoreRandomUUID();
      restoreGetRandomValues();
    }
  });

  it('uses getRandomValues to build UUID v4 when randomUUID is unavailable', () => {
    const restoreRandomUUID = withCryptoMethodOverride('randomUUID', undefined);
    const getRandomValuesMock = vi.fn((array: Uint8Array) => {
      for (let i = 0; i < array.length; i += 1) {
        array[i] = i;
      }
      return array;
    });
    const restoreGetRandomValues = withCryptoMethodOverride('getRandomValues', getRandomValuesMock);

    try {
      const id = newEntityId();
      expect(id).toMatch(UUID_V4_REGEX);
      expect(getRandomValuesMock).toHaveBeenCalledTimes(1);
    } finally {
      restoreRandomUUID();
      restoreGetRandomValues();
    }
  });

  it('uses Math.random fallback when both randomUUID and getRandomValues are unavailable', () => {
    const restoreRandomUUID = withCryptoMethodOverride('randomUUID', undefined);
    const restoreGetRandomValues = withCryptoMethodOverride('getRandomValues', undefined);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    try {
      const id = newEntityId();
      expect(id).toMatch(UUID_V4_REGEX);
    } finally {
      restoreRandomUUID();
      restoreGetRandomValues();
    }
  });
});
