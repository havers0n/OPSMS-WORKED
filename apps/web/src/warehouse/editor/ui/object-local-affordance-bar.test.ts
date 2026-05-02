import { describe, expect, it } from 'vitest';
import { resolveObjectLocalAffordanceBarPosition } from './object-local-affordance-bar';

describe('resolveObjectLocalAffordanceBarPosition', () => {
  it('prefers rendering above the selected object when there is room', () => {
    expect(
      resolveObjectLocalAffordanceBarPosition({
        anchorRect: { x: 160, y: 120, width: 80, height: 24 },
        viewport: { width: 500, height: 400 },
        barSize: { width: 200, height: 40 }
      })
    ).toEqual({
      left: 200,
      top: 72,
      transform: 'translateX(-50%)'
    });
  });

  it('flips below and clamps horizontally near viewport edges', () => {
    expect(
      resolveObjectLocalAffordanceBarPosition({
        anchorRect: { x: 460, y: 12, width: 30, height: 20 },
        viewport: { width: 500, height: 400 },
        barSize: { width: 180, height: 36 }
      })
    ).toEqual({
      left: 402,
      top: 40,
      transform: 'translateX(-50%)'
    });
  });
});
