const LAST_DEMAND_CONTEXT_KEY = 'wos:demand-planning:last-context';

interface DemandLastContext {
  mode: 'demand';
  batchId: string;
  draftId: string;
  url: string;
  savedAt: string;
  sourceFile?: string;
  sourceSheet?: string;
}

function getDemandLastContext(): DemandLastContext | null {
  try {
    const raw = localStorage.getItem(LAST_DEMAND_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemandLastContext;
    if (!parsed.batchId || !parsed.draftId) return null;
    return parsed;
  } catch {
    // localStorage may be unavailable or data corrupted
    return null;
  }
}

function saveDemandLastContext(context: DemandLastContext): void {
  try {
    localStorage.setItem(LAST_DEMAND_CONTEXT_KEY, JSON.stringify({ ...context, savedAt: new Date().toISOString() }));
  } catch {
    // localStorage may be unavailable
  }
}

function clearDemandLastContext(): void {
  try {
    localStorage.removeItem(LAST_DEMAND_CONTEXT_KEY);
  } catch {
    // localStorage may be unavailable
  }
}

export type { DemandLastContext };
export { getDemandLastContext, saveDemandLastContext, clearDemandLastContext };
