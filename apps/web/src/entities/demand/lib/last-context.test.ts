// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { getDemandLastContext, saveDemandLastContext, clearDemandLastContext } from './last-context';

const MOCK_CONTEXT = {
  mode: 'demand' as const,
  batchId: 'batch-123',
  draftId: 'draft-456',
  url: '/operator/manual/lines?batchId=batch-123&draftId=draft-456&mode=demand',
  savedAt: new Date('2026-06-27T10:00:00Z').toISOString(),
  sourceFile: 'datasheet.xlsx',
  sourceSheet: 'DataSheet',
};

describe('demand last context', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no context is saved', () => {
    expect(getDemandLastContext()).toBeNull();
  });

  it('saves and retrieves the full context with savedAt auto-set', () => {
    saveDemandLastContext(MOCK_CONTEXT);
    const retrieved = getDemandLastContext();
    expect(retrieved).not.toBeNull();
    expect(retrieved!.mode).toBe('demand');
    expect(retrieved!.batchId).toBe('batch-123');
    expect(retrieved!.draftId).toBe('draft-456');
    expect(retrieved!.url).toBe(MOCK_CONTEXT.url);
    expect(retrieved!.sourceFile).toBe('datasheet.xlsx');
    expect(retrieved!.sourceSheet).toBe('DataSheet');
    expect(retrieved!.savedAt).toBeTruthy();
  });

  it('returns null for corrupted JSON', () => {
    localStorage.setItem('wos:demand-planning:last-context', '{not-valid-json}');
    expect(getDemandLastContext()).toBeNull();
  });

  it('returns null when batchId is missing', () => {
    localStorage.setItem('wos:demand-planning:last-context', JSON.stringify({ draftId: 'draft-456' }));
    expect(getDemandLastContext()).toBeNull();
  });

  it('returns null when draftId is missing', () => {
    localStorage.setItem('wos:demand-planning:last-context', JSON.stringify({ batchId: 'batch-123' }));
    expect(getDemandLastContext()).toBeNull();
  });

  it('clearDemandLastContext removes the stored context', () => {
    saveDemandLastContext(MOCK_CONTEXT);
    expect(getDemandLastContext()).not.toBeNull();
    clearDemandLastContext();
    expect(getDemandLastContext()).toBeNull();
  });

  it('overwrites previous context when saving new one', () => {
    saveDemandLastContext(MOCK_CONTEXT);
    const newCtx = { ...MOCK_CONTEXT, batchId: 'batch-789', draftId: 'draft-789' };
    saveDemandLastContext(newCtx);
    const retrieved = getDemandLastContext();
    expect(retrieved!.batchId).toBe('batch-789');
    expect(retrieved!.draftId).toBe('draft-789');
  });

  it('handles localStorage unavailability gracefully', () => {
    const originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error('unavailable'); };
    expect(getDemandLastContext()).toBeNull();
    Storage.prototype.getItem = originalGetItem;
  });

  it('saves context with empty sourceFile/sourceSheet', () => {
    saveDemandLastContext({
      mode: 'demand',
      batchId: 'batch-111',
      draftId: 'draft-222',
      url: '/operator/manual/lines?batchId=batch-111&draftId=draft-222&mode=demand',
      savedAt: new Date().toISOString(),
    });
    const retrieved = getDemandLastContext();
    expect(retrieved).not.toBeNull();
    expect(retrieved!.batchId).toBe('batch-111');
    expect(retrieved!.sourceFile).toBeUndefined();
  });
});
