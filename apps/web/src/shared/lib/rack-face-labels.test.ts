import { describe, it, expect } from 'vitest';
import { faceAtViewportEdge, formatRackAxis } from './rack-face-labels';

describe('faceAtViewportEdge', () => {
  it('maps correctly at 0°', () => {
    expect(faceAtViewportEdge(0, 'north')).toBe('A');
    expect(faceAtViewportEdge(0, 'south')).toBe('B');
    expect(faceAtViewportEdge(0, 'west')).toBe('C');
    expect(faceAtViewportEdge(0, 'east')).toBe('D');
  });

  it('maps correctly at 90°', () => {
    expect(faceAtViewportEdge(90, 'north')).toBe('C');
    expect(faceAtViewportEdge(90, 'south')).toBe('D');
    expect(faceAtViewportEdge(90, 'west')).toBe('B');
    expect(faceAtViewportEdge(90, 'east')).toBe('A');
  });

  it('maps correctly at 180°', () => {
    expect(faceAtViewportEdge(180, 'north')).toBe('B');
    expect(faceAtViewportEdge(180, 'south')).toBe('A');
    expect(faceAtViewportEdge(180, 'west')).toBe('D');
    expect(faceAtViewportEdge(180, 'east')).toBe('C');
  });

  it('maps correctly at 270°', () => {
    expect(faceAtViewportEdge(270, 'north')).toBe('D');
    expect(faceAtViewportEdge(270, 'south')).toBe('C');
    expect(faceAtViewportEdge(270, 'west')).toBe('A');
    expect(faceAtViewportEdge(270, 'east')).toBe('B');
  });

  it('normalizes non-quarter-turn values', () => {
    expect(faceAtViewportEdge(45, 'north')).toBe('C');   // rounds to 90° (Math.round(0.5)===1)
    expect(faceAtViewportEdge(91, 'north')).toBe('C');   // rounds to 90°
    expect(faceAtViewportEdge(360, 'north')).toBe('A');  // same as 0°
    expect(faceAtViewportEdge(-90, 'north')).toBe('D');  // same as 270°
  });
});

describe('formatRackAxis', () => {
  it('formats NS as Vertical', () => {
    expect(formatRackAxis('NS')).toBe('Vertical');
  });

  it('formats WE as Horizontal', () => {
    expect(formatRackAxis('WE')).toBe('Horizontal');
  });
});
