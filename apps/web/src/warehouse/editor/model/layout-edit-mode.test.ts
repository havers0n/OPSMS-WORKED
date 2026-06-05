import { describe, expect, it } from 'vitest';
import {
  canEditLayoutGeometry,
  isLayoutEditModeEditable,
  resolveLayoutEditMode,
  resolveLayoutReadOnlyReason,
  resolveRackReadOnlyReason
} from './layout-edit-mode';

describe('layout edit mode', () => {
  it('treats layout + draft + editing as editable', () => {
    const mode = resolveLayoutEditMode({
      viewMode: 'layout',
      draft: { state: 'draft' },
      layoutInteractionMode: 'editing'
    });

    expect(mode).toBe('draft-editing');
    expect(isLayoutEditModeEditable(mode)).toBe(true);
    expect(resolveLayoutReadOnlyReason(mode)).toBeNull();
  });

  it('treats layout + draft + preview as draft-preview (not editable)', () => {
    const mode = resolveLayoutEditMode({
      viewMode: 'layout',
      draft: { state: 'draft' },
      layoutInteractionMode: 'preview'
    });

    expect(mode).toBe('draft-preview');
    expect(isLayoutEditModeEditable(mode)).toBe(false);
    expect(resolveLayoutReadOnlyReason(mode)).toBe('draft-preview');
  });

  it('treats published and archived layout state as published readonly', () => {
    expect(
      resolveLayoutEditMode({
        viewMode: 'layout',
        draft: { state: 'published' },
        layoutInteractionMode: 'preview'
      })
    ).toBe('published-readonly');
    expect(
      resolveLayoutEditMode({
        viewMode: 'layout',
        draft: { state: 'archived' },
        layoutInteractionMode: 'preview'
      })
    ).toBe('published-readonly');
  });

  it('distinguishes non-layout readonly from missing layout', () => {
    expect(
      resolveLayoutEditMode({
        viewMode: 'storage',
        draft: { state: 'draft' },
        layoutInteractionMode: 'preview'
      })
    ).toBe('non-layout-readonly');
    expect(
      resolveLayoutEditMode({
        viewMode: 'layout',
        draft: null,
        layoutInteractionMode: 'preview'
      })
    ).toBe('no-layout');
  });

  it('canEditLayoutGeometry requires layout + editing + draft', () => {
    expect(
      canEditLayoutGeometry({
        viewMode: 'layout',
        layoutInteractionMode: 'editing',
        draft: { state: 'draft' }
      })
    ).toBe(true);

    expect(
      canEditLayoutGeometry({
        viewMode: 'layout',
        layoutInteractionMode: 'preview',
        draft: { state: 'draft' }
      })
    ).toBe(false);

    expect(
      canEditLayoutGeometry({
        viewMode: 'view',
        layoutInteractionMode: 'editing',
        draft: { state: 'draft' }
      })
    ).toBe(false);
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
    expect(
      resolveRackReadOnlyReason({
        layoutEditMode: 'draft-preview',
        rack: { isLocked: true }
      })
    ).toBe('draft-preview');
  });
});
