import { describe, expect, it } from 'vitest';
import {
  isLayoutEditModeEditable,
  resolveLayoutEditMode,
  resolveLayoutReadOnlyReason,
  resolveRackReadOnlyReason
} from './layout-edit-mode';

describe('layout edit mode', () => {
  it('treats layout draft state as editable', () => {
    const mode = resolveLayoutEditMode({
      viewMode: 'layout',
      draft: { state: 'draft' }
    });

    expect(mode).toBe('draft-editing');
    expect(isLayoutEditModeEditable(mode)).toBe(true);
    expect(resolveLayoutReadOnlyReason(mode)).toBeNull();
  });

  it('treats published and archived layout state as published readonly', () => {
    expect(
      resolveLayoutEditMode({
        viewMode: 'layout',
        draft: { state: 'published' }
      })
    ).toBe('published-readonly');
    expect(
      resolveLayoutEditMode({
        viewMode: 'layout',
        draft: { state: 'archived' }
      })
    ).toBe('published-readonly');
  });

  it('distinguishes non-layout readonly from missing layout', () => {
    expect(
      resolveLayoutEditMode({
        viewMode: 'storage',
        draft: { state: 'draft' }
      })
    ).toBe('non-layout-readonly');
    expect(
      resolveLayoutEditMode({
        viewMode: 'layout',
        draft: null
      })
    ).toBe('no-layout');
  });

  it('returns rack-locked only after layout editability is established', () => {
    expect(
      resolveRackReadOnlyReason({
        layoutEditMode: 'draft-editing',
        rack: { isLocked: true }
      })
    ).toBe('rack-locked');
    expect(
      resolveRackReadOnlyReason({
        layoutEditMode: 'draft-editing',
        rack: { isLocked: false }
      })
    ).toBeNull();
    expect(
      resolveRackReadOnlyReason({
        layoutEditMode: 'published-readonly',
        rack: { isLocked: true }
      })
    ).toBe('published-readonly');
  });
});
