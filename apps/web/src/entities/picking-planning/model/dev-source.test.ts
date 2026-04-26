import { describe, expect, it } from 'vitest';
import { readDevPickingPlanningSourceFromSearch } from './dev-source';

describe('readDevPickingPlanningSourceFromSearch', () => {
  it('seeds order source outside production', () => {
    expect(
      readDevPickingPlanningSourceFromSearch(
        '?pickingPlanOrderIds=order-1,order-2',
        'test'
      )
    ).toEqual({ kind: 'orders', orderIds: ['order-1', 'order-2'] });
  });

  it('seeds wave source outside production', () => {
    expect(
      readDevPickingPlanningSourceFromSearch('?pickingPlanWaveId=wave-1', 'development')
    ).toEqual({ kind: 'wave', waveId: 'wave-1' });
  });

  it('does not seed in production', () => {
    expect(
      readDevPickingPlanningSourceFromSearch('?pickingPlanWaveId=wave-1', 'production')
    ).toEqual({ kind: 'none' });
  });
});
