import { describe, expect, it } from 'vitest';
import { formatPickInstruction } from './pick-instruction-format';

describe('formatPickInstruction', () => {
  it('formats exact packaging decomposition', () => {
    const result = formatPickInstruction({
      qtyEach: 8,
      packagingLevels: [{ id: 'box', code: 'boxes', name: 'Box', qtyEach: 2 }]
    });

    expect(result.instruction).toBe('4 boxes');
    expect(result.degraded).toBe(false);
  });

  it('formats mixed packaging decomposition', () => {
    const result = formatPickInstruction({
      qtyEach: 9,
      packagingLevels: [{ id: 'box', code: 'boxes', name: 'Box', qtyEach: 2 }]
    });

    expect(result.instruction).toBe('4 boxes + 1 unit');
    expect(result.degraded).toBe(false);
  });

  it('falls back to raw units with no packaging', () => {
    const result = formatPickInstruction({ qtyEach: 9, packagingLevels: [] });

    expect(result.instruction).toBe('9 units');
    expect(result.degraded).toBe(false);
  });

  it('ignores invalid packaging and falls back when nothing valid remains', () => {
    const result = formatPickInstruction({
      qtyEach: 9,
      packagingLevels: [
        { id: 'bad', code: '', name: 'Bad', qtyEach: 0 },
        { id: 'bad2', code: 'broken', name: 'Broken', qtyEach: -1 }
      ]
    });

    expect(result.instruction).toBe('9 units');
    expect(result.degraded).toBe(true);
    expect(result.reason).toBe('invalid_packaging_levels');
  });

  it('falls back to raw units for duplicate same-size packaging', () => {
    const result = formatPickInstruction({
      qtyEach: 8,
      packagingLevels: [
        { id: 'box-a', code: 'box-a', name: 'Box A', qtyEach: 2 },
        { id: 'box-b', code: 'box-b', name: 'Box B', qtyEach: 2 }
      ]
    });

    expect(result.instruction).toBe('8 units');
    expect(result.degraded).toBe(true);
    expect(result.reason).toBe('ambiguous_packaging');
  });

  it('falls back for non-integer qtyEach without flooring', () => {
    const result = formatPickInstruction({
      qtyEach: 8.5,
      packagingLevels: [{ id: 'box', code: 'boxes', name: 'Box', qtyEach: 2 }]
    });

    expect(result.instruction).toBe('8.5 units');
    expect(result.degraded).toBe(true);
    expect(result.reason).toBe('non_integer_quantity');
  });

  it('never over-picks', () => {
    const result = formatPickInstruction({
      qtyEach: 5,
      packagingLevels: [{ id: 'box', code: 'boxes', name: 'Box', qtyEach: 2 }]
    });

    expect(result.instruction).toBe('2 boxes + 1 unit');
  });

  it('uses largest practical levels first', () => {
    const result = formatPickInstruction({
      qtyEach: 23,
      packagingLevels: [
        { id: 'each', code: 'eaches', name: 'Each', qtyEach: 1 },
        { id: 'master', code: 'masters', name: 'Master', qtyEach: 8 },
        { id: 'box', code: 'boxes', name: 'Box', qtyEach: 2 }
      ]
    });

    expect(result.instruction).toBe('2 masters + 3 boxes + 1 unit');
  });
});
