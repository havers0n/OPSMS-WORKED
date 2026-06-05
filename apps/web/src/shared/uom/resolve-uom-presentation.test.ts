import { describe, expect, it } from 'vitest';
import { resolveUomPresentation } from './resolve-uom-presentation';

describe('resolveUomPresentation', () => {
  describe('English locale', () => {
    it('returns PCS for null', () => {
      expect(resolveUomPresentation(null, 'en')).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(resolveUomPresentation(undefined, 'en')).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(resolveUomPresentation('', 'en')).toBe('');
    });

    it('normalizes EA to PCS', () => {
      expect(resolveUomPresentation('EA', 'en')).toBe('PCS');
    });

    it('normalizes lowercase ea to PCS', () => {
      expect(resolveUomPresentation('ea', 'en')).toBe('PCS');
    });

    it('normalizes pcs to PCS', () => {
      expect(resolveUomPresentation('pcs', 'en')).toBe('PCS');
    });

    it('normalizes PCs to PCS', () => {
      expect(resolveUomPresentation('PCs', 'en')).toBe('PCS');
    });

    it('normalizes PCS to PCS', () => {
      expect(resolveUomPresentation('PCS', 'en')).toBe('PCS');
    });

    it('normalizes יח to PCS', () => {
      expect(resolveUomPresentation('יח', 'en')).toBe('PCS');
    });

    it('passes through unknown non-empty value as-is', () => {
      expect(resolveUomPresentation('BOX', 'en')).toBe('BOX');
    });

    it('passes through unknown non-empty lowercase value as-is', () => {
      expect(resolveUomPresentation('unknown', 'en')).toBe('unknown');
    });

    it('trims whitespace before matching', () => {
      expect(resolveUomPresentation('  EA  ', 'en')).toBe('PCS');
    });
  });

  describe('Hebrew locale', () => {
    it('normalizes EA to יח׳', () => {
      expect(resolveUomPresentation('EA', 'he')).toBe('יח׳');
    });

    it('normalizes pcs to יח׳', () => {
      expect(resolveUomPresentation('pcs', 'he')).toBe('יח׳');
    });

    it('normalizes PCS to יח׳', () => {
      expect(resolveUomPresentation('PCS', 'he')).toBe('יח׳');
    });

    it('normalizes PCs to יח׳', () => {
      expect(resolveUomPresentation('PCs', 'he')).toBe('יח׳');
    });

    it('normalizes יח to יח׳', () => {
      expect(resolveUomPresentation('יח', 'he')).toBe('יח׳');
    });

    it('passes through unknown value as-is in Hebrew', () => {
      expect(resolveUomPresentation('BOX', 'he')).toBe('BOX');
    });

    it('returns empty string for null', () => {
      expect(resolveUomPresentation(null, 'he')).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(resolveUomPresentation(undefined, 'he')).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(resolveUomPresentation('', 'he')).toBe('');
    });
  });
});
