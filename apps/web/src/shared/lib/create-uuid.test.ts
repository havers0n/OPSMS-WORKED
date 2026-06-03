import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUuid } from './create-uuid';

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

describe('createUuid', () => {
  it('uses crypto.randomUUID when available', () => {
    const expected = '11111111-1111-4111-8111-111111111111';
    let randomUuidCalls = 0;
    let getRandomValuesCalls = 0;
    const restoreRandomUUID = withCryptoMethodOverride('randomUUID', () => {
      randomUuidCalls += 1;
      return expected;
    });
    const restoreGetRandomValues = withCryptoMethodOverride('getRandomValues', <T extends ArrayBufferView>(array: T) => {
      getRandomValuesCalls += 1;
      return array;
    });

    try {
      expect(createUuid()).toBe(expected);
      expect(randomUuidCalls).toBe(1);
      expect(getRandomValuesCalls).toBe(0);
    } finally {
      restoreRandomUUID();
      restoreGetRandomValues();
    }
  });

  it('falls back to crypto.getRandomValues when randomUUID is unavailable', () => {
    const restoreRandomUUID = withCryptoMethodOverride('randomUUID', undefined);
    let getRandomValuesCalls = 0;
    const restoreGetRandomValues = withCryptoMethodOverride('getRandomValues', <T extends ArrayBufferView>(array: T) => {
      getRandomValuesCalls += 1;
      if (array instanceof Uint8Array) {
        for (let i = 0; i < array.length; i += 1) {
          array[i] = i;
        }
      }
      return array;
    });

    try {
      expect(createUuid()).toMatch(UUID_V4_REGEX);
      expect(getRandomValuesCalls).toBe(1);
    } finally {
      restoreRandomUUID();
      restoreGetRandomValues();
    }
  });

  it('sets UUID v4 version and variant bits in the fallback path', () => {
    const restoreRandomUUID = withCryptoMethodOverride('randomUUID', undefined);
    const restoreGetRandomValues = withCryptoMethodOverride('getRandomValues', <T extends ArrayBufferView>(array: T) => {
      if (array instanceof Uint8Array) {
        array.set([
          0x00, 0x11, 0x22, 0x33,
          0x44, 0x55, 0x06, 0x77,
          0x18, 0x99, 0xaa, 0xbb,
          0xcc, 0xdd, 0xee, 0xff
        ]);
      }
      return array;
    });

    try {
      expect(createUuid()).toBe('00112233-4455-4677-9899-aabbccddeeff');
    } finally {
      restoreRandomUUID();
      restoreGetRandomValues();
    }
  });

  it('throws a clear error when secure crypto UUID APIs are unavailable', () => {
    const restoreRandomUUID = withCryptoMethodOverride('randomUUID', undefined);
    const restoreGetRandomValues = withCryptoMethodOverride('getRandomValues', undefined);

    try {
      expect(() => createUuid()).toThrowError(
        'UUID generation requires crypto.randomUUID() or crypto.getRandomValues().'
      );
    } finally {
      restoreRandomUUID();
      restoreGetRandomValues();
    }
  });

  it('does not use Math.random in the fallback path', () => {
    const restoreRandomUUID = withCryptoMethodOverride('randomUUID', undefined);
    const restoreGetRandomValues = withCryptoMethodOverride('getRandomValues', <T extends ArrayBufferView>(array: T) => {
      if (array instanceof Uint8Array) {
        array.fill(0xaa);
      }
      return array;
    });
    const mathRandomSpy = vi.spyOn(Math, 'random');

    try {
      expect(createUuid()).toMatch(UUID_V4_REGEX);
      expect(mathRandomSpy).not.toHaveBeenCalled();
    } finally {
      restoreRandomUUID();
      restoreGetRandomValues();
    }
  });
});
