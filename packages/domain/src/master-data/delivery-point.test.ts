import { describe, expect, it } from 'vitest';
import { normalizeDeliveryPointAliasText, deliveryPointSchema, deliveryPointAliasSchema, deliveryPointMatchStatusSchema } from './delivery-point.js';

describe('normalizeDeliveryPointAliasText', () => {
  it('normalizes test case 1: regular alias with colon-space', () => {
    const result = normalizeDeliveryPointAliasText(' דור אלון - יסודות :950 ');
    expect(result).toBe('דור אלון - יסודות :950');
  });

  it('normalizes test case 2: alias with Hebrew text and hyphenated suffix', () => {
    const result = normalizeDeliveryPointAliasText('פז חב.לנפט -ניתוב - מנדלבאום : 513');
    expect(result).toBe('פז חב.לנפט -ניתוב - מנדלבאום : 513');
  });

  it('normalizes test case 3: alias with en-dash', () => {
    const result = normalizeDeliveryPointAliasText('דור אלון – יסודות :950');
    expect(result).toBe('דור אלון - יסודות :950');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeDeliveryPointAliasText('  test  ')).toBe('test');
  });

  it('collapses repeated whitespace', () => {
    expect(normalizeDeliveryPointAliasText('a   b    c')).toBe('a b c');
  });

  it('normalizes em-dash to hyphen', () => {
    expect(normalizeDeliveryPointAliasText('a — b')).toBe('a - b');
  });

  it('normalizes Hebrew maqaf to hyphen', () => {
    expect(normalizeDeliveryPointAliasText('a־b')).toBe('a-b');
  });

  it('normalizes Hebrew geresh to apostrophe', () => {
    expect(normalizeDeliveryPointAliasText('דוד׳ד')).toBe("דוד'ד");
  });

  it('normalizes Hebrew gershayim to double quote', () => {
    expect(normalizeDeliveryPointAliasText('ספר״ת')).toBe('ספר"ת');
  });

  it('removes Hebrew niqqud (combined marks)', () => {
    const withNiqqud = '\u05D0\u05B0\u05D1\u05B8\u05D2';  // אְבָג
    expect(normalizeDeliveryPointAliasText(withNiqqud)).toBe('\u05D0\u05D1\u05D2'); // אבג
  });

  it('normalizes backtick to straight apostrophe', () => {
    expect(normalizeDeliveryPointAliasText('a`b')).toBe("a'b");
  });

  it('normalizes acute accent to straight apostrophe', () => {
    expect(normalizeDeliveryPointAliasText('a´b')).toBe("a'b");
  });

  it('normalizes U+2212 minus sign to hyphen', () => {
    expect(normalizeDeliveryPointAliasText('a−b')).toBe('a-b');
  });

  it('returns empty string for input with only whitespace', () => {
    expect(normalizeDeliveryPointAliasText('   ')).toBe('');
  });

  it('preserves Hebrew letters through normalization', () => {
    const hebrew = 'שלום עולם';
    expect(normalizeDeliveryPointAliasText(hebrew)).toBe(hebrew);
  });
});

describe('deliveryPointSchema', () => {
  it('parses a valid delivery point', () => {
    const dp = {
      id: '00000000-0000-4000-8000-000000000001',
      sourceType: 'fuel_admin',
      sourceExternalId: 'dor-alon-yesodot',
      officialFuelAdminId: null,
      displayName: 'דור אלון - יסודות',
      companyName: 'דור אלון',
      siteName: 'יסודות',
      address: 'רחוב הראשי 1',
      municipality: null,
      latitude: 31.813,
      longitude: 34.648,
      status: 'active',
      createdAt: '2026-06-27T00:00:00.000Z',
      updatedAt: '2026-06-27T00:00:00.000Z'
    };
    expect(deliveryPointSchema.parse(dp)).toEqual(dp);
  });

  it('rejects invalid status', () => {
    expect(() =>
      deliveryPointSchema.parse({
        id: '00000000-0000-4000-8000-000000000001',
        sourceType: 'fuel_admin',
        sourceExternalId: 'test',
        displayName: 'Test',
        status: 'unknown'
      })
    ).toThrow();
  });
});

describe('deliveryPointAliasSchema', () => {
  it('parses a valid alias', () => {
    const alias = {
      id: '00000000-0000-4000-8000-000000000002',
      deliveryPointId: '00000000-0000-4000-8000-000000000001',
      aliasText: 'דור אלון - יסודות :950',
      normalizedAliasText: 'דור אלון - יסודות :950',
      aliasSource: 'order_import',
      confidence: 'confirmed',
      createdAt: '2026-06-27T00:00:00.000Z',
      updatedAt: '2026-06-27T00:00:00.000Z'
    };
    expect(deliveryPointAliasSchema.parse(alias)).toEqual(alias);
  });

  it('rejects invalid confidence', () => {
    expect(() =>
      deliveryPointAliasSchema.parse({
        id: '00000000-0000-4000-8000-000000000002',
        deliveryPointId: '00000000-0000-4000-8000-000000000001',
        aliasText: 'test',
        normalizedAliasText: 'test',
        aliasSource: 'test',
        confidence: 'bogus'
      })
    ).toThrow();
  });

  describe('deliveryPointMatchStatusSchema', () => {
    it('accepts matched', () => {
      expect(deliveryPointMatchStatusSchema.parse('matched')).toBe('matched');
    });

    it('accepts unmatched', () => {
      expect(deliveryPointMatchStatusSchema.parse('unmatched')).toBe('unmatched');
    });

    it('accepts ambiguous', () => {
      expect(deliveryPointMatchStatusSchema.parse('ambiguous')).toBe('ambiguous');
    });

    it('accepts not_attempted', () => {
      expect(deliveryPointMatchStatusSchema.parse('not_attempted')).toBe('not_attempted');
    });

    it('rejects invalid status', () => {
      expect(() => deliveryPointMatchStatusSchema.parse('invalid')).toThrow();
    });
  });
});
