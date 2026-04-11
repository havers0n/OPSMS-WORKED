import { describe, expect, it } from 'vitest';
import { resolveContextPanelVisibility, resolveContextPanelIntent } from './context-panel-logic';
import type {
  EditorMode,
  EditorSelection,
  InteractionScope,
  RackSideFocus
} from '@/widgets/warehouse-editor/model/editor-types';

// ─── helpers ──────────────────────────────────────────────────────────────────

const noSelection: EditorSelection = { type: 'none' };
const rackSelection = (ids: string[]): EditorSelection => ({ type: 'rack', rackIds: ids });
const zoneSelection = (zoneId: string): EditorSelection => ({ type: 'zone', zoneId });
const wallSelection = (wallId: string): EditorSelection => ({ type: 'wall', wallId });
const rackSideSelection = (rackId: string, side: RackSideFocus): EditorSelection => ({
  type: 'rack',
  rackIds: [rackId],
  focus: { type: 'side', side }
});
const cellSelection = (cellId: string): EditorSelection => ({ type: 'cell', cellId });
const containerSelection = (containerId: string): EditorSelection => ({ type: 'container', containerId });

// ─── resolveContextPanelVisibility ───────────────────────────────────────────

describe('resolveContextPanelVisibility', () => {
  it('returns true when scope is idle so mode guidance can render', () => {
    expect(resolveContextPanelVisibility({ scope: 'idle', editorMode: 'select', viewMode: 'layout' })).toBe(true);
    expect(resolveContextPanelVisibility({ scope: 'idle', editorMode: 'select', viewMode: 'view' })).toBe(true);
    expect(resolveContextPanelVisibility({ scope: 'idle', editorMode: 'select', viewMode: 'storage' })).toBe(true);
  });

  it('returns false in layout mode with a draw/create tool active', () => {
    expect(resolveContextPanelVisibility({ scope: 'object', editorMode: 'place', viewMode: 'layout' })).toBe(false);
    expect(resolveContextPanelVisibility({ scope: 'object', editorMode: 'draw-zone', viewMode: 'layout' })).toBe(false);
  });

  it('returns true for object scope in select mode', () => {
    expect(resolveContextPanelVisibility({ scope: 'object', editorMode: 'select', viewMode: 'layout' })).toBe(true);
    expect(resolveContextPanelVisibility({ scope: 'object', editorMode: 'select', viewMode: 'view' })).toBe(true);
    expect(resolveContextPanelVisibility({ scope: 'object', editorMode: 'select', viewMode: 'storage' })).toBe(true);
  });

  it('preserves current contract: storage object scope remains visible in select mode', () => {
    expect(resolveContextPanelVisibility({ scope: 'object', editorMode: 'select', viewMode: 'storage' })).toBe(true);
  });

  it('returns true for workflow scope', () => {
    expect(resolveContextPanelVisibility({ scope: 'workflow', editorMode: 'select', viewMode: 'storage' })).toBe(true);
    expect(resolveContextPanelVisibility({ scope: 'workflow', editorMode: 'select', viewMode: 'view' })).toBe(true);
  });

  it('place tool suppression only applies to layout mode', () => {
    // place mode in view/storage shouldn't happen, but if it does, don't suppress
    expect(resolveContextPanelVisibility({ scope: 'object', editorMode: 'place', viewMode: 'view' })).toBe(true);
    expect(resolveContextPanelVisibility({ scope: 'object', editorMode: 'place', viewMode: 'storage' })).toBe(true);
  });
});

// ─── resolveContextPanelIntent ──────────────────────────────────────────────

describe('resolveContextPanelIntent — idle cases', () => {
  it('returns hidden for all idle scope cases (no idle panel shown)', () => {
    expect(resolveContextPanelIntent({
      scope: 'idle', editorMode: 'select', viewMode: 'layout', selection: noSelection
    })).toBe('hidden');

    expect(resolveContextPanelIntent({
      scope: 'idle', editorMode: 'select', viewMode: 'storage', selection: noSelection
    })).toBe('hidden');

    expect(resolveContextPanelIntent({
      scope: 'idle', editorMode: 'select', viewMode: 'view', selection: noSelection
    })).toBe('hidden');
  });
});

describe('resolveContextPanelIntent — hidden cases', () => {
  it('returns hidden in layout mode with a draw/create tool active', () => {
    expect(resolveContextPanelIntent({
      scope: 'object', editorMode: 'place', viewMode: 'layout', selection: rackSelection(['r1'])
    })).toBe('hidden');
    expect(resolveContextPanelIntent({
      scope: 'object', editorMode: 'draw-zone', viewMode: 'layout', selection: zoneSelection('z1')
    })).toBe('hidden');
  });
});

describe('resolveContextPanelIntent — rack context', () => {
  it('returns rack-context for single rack selection', () => {
    expect(resolveContextPanelIntent({
      scope: 'object', editorMode: 'select', viewMode: 'layout', selection: rackSelection(['r1'])
    })).toBe('rack-context');
  });

  it('returns rack-context in view mode for single rack', () => {
    expect(resolveContextPanelIntent({
      scope: 'object', editorMode: 'select', viewMode: 'view', selection: rackSelection(['r1'])
    })).toBe('rack-context');
  });

  it('characterizes current transitional behavior: storage single rack selection resolves to rack-context (may intentionally change later)', () => {
    expect(resolveContextPanelIntent({
      scope: 'object', editorMode: 'select', viewMode: 'storage', selection: rackSelection(['r1'])
    })).toBe('rack-context');
  });

  it('returns multi-rack for 2+ racks', () => {
    expect(resolveContextPanelIntent({
      scope: 'object', editorMode: 'select', viewMode: 'layout', selection: rackSelection(['r1', 'r2'])
    })).toBe('multi-rack');
  });

  it('returns multi-rack for 3+ racks', () => {
    expect(resolveContextPanelIntent({
      scope: 'object', editorMode: 'select', viewMode: 'layout', selection: rackSelection(['r1', 'r2', 'r3'])
    })).toBe('multi-rack');
  });
});

describe('resolveContextPanelIntent — rack side context', () => {
  it('returns rack-side-context for a side-focused single rack selection', () => {
    expect(resolveContextPanelIntent({
      scope: 'object',
      editorMode: 'select',
      viewMode: 'layout',
      selection: rackSideSelection('r1', 'east')
    })).toBe('rack-side-context');
  });

  it('returns multi-rack when multiple racks are selected even if one selection carries stale side focus', () => {
    expect(resolveContextPanelIntent({
      scope: 'object',
      editorMode: 'select',
      viewMode: 'layout',
      selection: {
        type: 'rack',
        rackIds: ['r1', 'r2'],
        focus: { type: 'side', side: 'north' }
      }
    })).toBe('multi-rack');
  });
});

describe('resolveContextPanelIntent — cell context', () => {
  it('returns cell-context for cell selection in storage mode', () => {
    expect(resolveContextPanelIntent({
      scope: 'object', editorMode: 'select', viewMode: 'storage', selection: cellSelection('rack-1:sec-abc:0')
    })).toBe('cell-context');
  });

  it('returns cell-context for cell selection in view mode', () => {
    expect(resolveContextPanelIntent({
      scope: 'object', editorMode: 'select', viewMode: 'view', selection: cellSelection('c-1')
    })).toBe('cell-context');
  });
});

describe('resolveContextPanelIntent — zone context', () => {
  it('returns zone-context for zone selection in layout mode', () => {
    expect(resolveContextPanelIntent({
      scope: 'object', editorMode: 'select', viewMode: 'layout', selection: zoneSelection('z1')
    })).toBe('zone-context');
  });
});

describe('resolveContextPanelIntent — wall context', () => {
  it('returns wall-context for wall selection in layout mode', () => {
    expect(resolveContextPanelIntent({
      scope: 'object', editorMode: 'select', viewMode: 'layout', selection: wallSelection('w1')
    })).toBe('wall-context');
  });
});

describe('resolveContextPanelIntent — container context', () => {
  it('returns container-context for container selection', () => {
    expect(resolveContextPanelIntent({
      scope: 'object', editorMode: 'select', viewMode: 'storage', selection: containerSelection('ct-1')
    })).toBe('container-context');
  });
});

describe('resolveContextPanelIntent — workflow', () => {
  it('returns workflow when scope is workflow regardless of selection', () => {
    expect(resolveContextPanelIntent({
      scope: 'workflow', editorMode: 'select', viewMode: 'storage', selection: cellSelection('c-1')
    })).toBe('workflow');
  });

  it('returns workflow with container selection during workflow', () => {
    expect(resolveContextPanelIntent({
      scope: 'workflow', editorMode: 'select', viewMode: 'storage', selection: containerSelection('ct-1')
    })).toBe('workflow');
  });
});

// ─── invariants ──────────────────────────────────────────────────────────────

describe('resolveContextPanelIntent — invariants', () => {
  it('visibility and intent agree: visible=false always means intent=hidden', () => {
    const cases: Array<{ scope: InteractionScope; editorMode: EditorMode; viewMode: 'view' | 'storage' | 'layout' }> = [
      { scope: 'object', editorMode: 'place', viewMode: 'layout' },
      { scope: 'object', editorMode: 'draw-zone', viewMode: 'layout' }
    ];

    for (const params of cases) {
      expect(resolveContextPanelVisibility(params)).toBe(false);
      expect(resolveContextPanelIntent({ ...params, selection: noSelection })).toBe('hidden');
    }
  });

  it('none selection with object scope still returns hidden (edge case)', () => {
    // This shouldn't normally happen (object scope implies a selection), but be safe
    expect(resolveContextPanelIntent({
      scope: 'object', editorMode: 'select', viewMode: 'layout', selection: noSelection
    })).toBe('hidden');
  });
});
