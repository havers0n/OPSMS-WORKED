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
    let randomUuidCalls = 0;
    let getRandomValuesCalls = 0;
    const randomUuid: Crypto['randomUUID'] = () => {
      randomUuidCalls += 1;
      return expected;
    };
    const getRandomValues: Crypto['getRandomValues'] = <T extends ArrayBufferView>(array: T) => {
      getRandomValuesCalls += 1;
      return array;
    };
    const restoreRandomUUID = withCryptoMethodOverride('randomUUID', randomUuid);
    const restoreGetRandomValues = withCryptoMethodOverride('getRandomValues', getRandomValues);

    try {
      expect(newEntityId()).toBe(expected);
      expect(randomUuidCalls).toBe(1);
      expect(getRandomValuesCalls).toBe(0);
    } finally {
      restoreRandomUUID();
      restoreGetRandomValues();
    }
  });

  it('uses getRandomValues to build UUID v4 when randomUUID is unavailable', () => {
    const restoreRandomUUID = withCryptoMethodOverride('randomUUID', undefined);
    let getRandomValuesCalls = 0;
    const getRandomValues: Crypto['getRandomValues'] = <T extends ArrayBufferView>(array: T) => {
      getRandomValuesCalls += 1;
      if (array instanceof Uint8Array) {
        for (let i = 0; i < array.length; i += 1) {
          array[i] = i;
        }
      }
      return array;
    };
    const restoreGetRandomValues = withCryptoMethodOverride('getRandomValues', getRandomValues);

    try {
      const id = newEntityId();
      expect(id).toMatch(UUID_V4_REGEX);
      expect(getRandomValuesCalls).toBe(1);
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
