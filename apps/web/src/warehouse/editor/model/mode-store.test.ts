import { afterEach, describe, expect, it } from 'vitest';
import { useModeStore } from './mode-store';

afterEach(() => {
  useModeStore.setState({
    viewMode: 'view',
    viewStage: 'map',
    editorMode: 'select',
    layoutInteractionMode: 'preview',
    lastNonLayoutViewMode: 'view',
  });
});

describe('mode-store', () => {
  it('defaults to view + preview', () => {
    const state = useModeStore.getState();
    expect(state.viewMode).toBe('view');
    expect(state.layoutInteractionMode).toBe('preview');
    expect(state.lastNonLayoutViewMode).toBe('view');
  });

  it('enterLayoutPreview sets layout + preview and remembers previous mode', () => {
    useModeStore.getState().enterLayoutPreview();
    const state = useModeStore.getState();
    expect(state.viewMode).toBe('layout');
    expect(state.layoutInteractionMode).toBe('preview');
    expect(state.lastNonLayoutViewMode).toBe('view');
  });

  it('enterLayoutPreview from storage remembers storage', () => {
    useModeStore.getState().setViewMode('storage');
    useModeStore.getState().enterLayoutPreview();
    const state = useModeStore.getState();
    expect(state.viewMode).toBe('layout');
    expect(state.lastNonLayoutViewMode).toBe('storage');
  });

  it('startLayoutEditing transitions to editing', () => {
    useModeStore.getState().enterLayoutPreview();
    useModeStore.getState().startLayoutEditing();
    const state = useModeStore.getState();
    expect(state.viewMode).toBe('layout');
    expect(state.layoutInteractionMode).toBe('editing');
  });

  it('finishLayoutEditing returns to preview', () => {
    useModeStore.getState().enterLayoutPreview();
    useModeStore.getState().startLayoutEditing();
    useModeStore.getState().finishLayoutEditing();
    const state = useModeStore.getState();
    expect(state.viewMode).toBe('layout');
    expect(state.layoutInteractionMode).toBe('preview');
  });

  it('exitLayout restores lastNonLayoutViewMode', () => {
    useModeStore.getState().enterLayoutPreview();
    useModeStore.getState().exitLayout();
    const state = useModeStore.getState();
    expect(state.viewMode).toBe('view');
    expect(state.layoutInteractionMode).toBe('preview');
  });

  it('exitLayout from storage preview restores storage', () => {
    useModeStore.getState().setViewMode('storage');
    useModeStore.getState().enterLayoutPreview();
    useModeStore.getState().exitLayout();
    const state = useModeStore.getState();
    expect(state.viewMode).toBe('storage');
    expect(state.layoutInteractionMode).toBe('preview');
  });

  it('setViewMode from layout to view resets interaction mode', () => {
    useModeStore.getState().enterLayoutPreview();
    useModeStore.getState().startLayoutEditing();
    useModeStore.getState().setViewMode('view');
    const state = useModeStore.getState();
    expect(state.viewMode).toBe('view');
    expect(state.layoutInteractionMode).toBe('preview');
    expect(state.lastNonLayoutViewMode).toBe('view');
  });

  it('setViewMode from layout to storage updates lastNonLayoutViewMode', () => {
    useModeStore.getState().enterLayoutPreview();
    useModeStore.getState().setViewMode('storage');
    const state = useModeStore.getState();
    expect(state.viewMode).toBe('storage');
    expect(state.layoutInteractionMode).toBe('preview');
    expect(state.lastNonLayoutViewMode).toBe('storage');
  });

  it('setViewMode to layout always opens preview', () => {
    useModeStore.getState().setViewMode('layout');
    const state = useModeStore.getState();
    expect(state.viewMode).toBe('layout');
    expect(state.layoutInteractionMode).toBe('preview');
    expect(state.lastNonLayoutViewMode).toBe('view');
  });
});
