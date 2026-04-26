import { describe, expect, it } from 'vitest';
import { createPlanningWarning, dedupePlanningWarnings, warningMessages } from './planning-warning';

describe('planning warnings', () => {
  it('creates a structured warning with default severity', () => {
    expect(createPlanningWarning('EMPTY_WORKLOAD', 'WorkPackage has no tasks.', { source: 'domain' })).toEqual({
      code: 'EMPTY_WORKLOAD',
      severity: 'warning',
      message: 'WorkPackage has no tasks.',
      source: 'domain',
      details: undefined
    });
  });

  it('dedupes by code, message, and details while preserving order', () => {
    const first = createPlanningWarning('UNKNOWN_WEIGHT', 'Some tasks are missing weight.', { details: { count: 2 } });
    const second = createPlanningWarning('UNKNOWN_VOLUME', 'Some tasks are missing volume.', { details: { count: 1 } });

    expect(dedupePlanningWarnings([first, second, first])).toEqual([first, second]);
  });

  it('maps structured warnings back to compatibility messages', () => {
    expect(warningMessages([createPlanningWarning('DISTANCE_MODE_FALLBACK', 'Fallback.', { severity: 'info' })])).toEqual([
      'Fallback.'
    ]);
  });
});
