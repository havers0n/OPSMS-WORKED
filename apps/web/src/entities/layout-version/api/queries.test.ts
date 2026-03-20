import { describe, expect, it } from 'vitest';
import { layoutVersionKeys } from './queries';

describe('layoutVersionKeys', () => {
  it('rebinds the active draft key when floor changes', () => {
    expect(layoutVersionKeys.activeDraft('floor-a')).not.toEqual(layoutVersionKeys.activeDraft('floor-b'));
    expect(layoutVersionKeys.activeDraft(null)).toEqual(['layout-version', 'active-draft', 'none']);
  });

  it('rebinds the workspace key when floor changes', () => {
    expect(layoutVersionKeys.workspace('floor-a')).not.toEqual(layoutVersionKeys.workspace('floor-b'));
    expect(layoutVersionKeys.workspace(null)).toEqual(['layout-version', 'workspace', 'none']);
  });
});
