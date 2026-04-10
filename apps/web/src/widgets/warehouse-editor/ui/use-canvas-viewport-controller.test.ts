import { describe, expect, it } from 'vitest';
import { LOD_CELL_ENTRY } from '@/entities/layout-version/lib/canvas-geometry';
import { getModeEntryMinZoom } from './use-canvas-viewport-controller';

describe('getModeEntryMinZoom', () => {
  it('keeps cell-visible floor for view mode', () => {
    expect(getModeEntryMinZoom('view')).toBe(LOD_CELL_ENTRY);
  });

  it('does not force cell-visible floor for storage mode', () => {
    expect(getModeEntryMinZoom('storage')).toBe(0);
  });

  it('does not apply entry floor in layout mode', () => {
    expect(getModeEntryMinZoom('layout')).toBe(0);
  });
});
