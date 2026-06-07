import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { useT } from '@/shared/i18n';
import {
  formatClientRuntimeDiagnosticsForClipboard,
  getClientRuntimeDiagnosticsSnapshot,
  installGlobalClientRuntimeDiagnostics,
  recordClientRuntimeEvent,
  setClientRuntimeRoute,
  subscribeClientRuntimeDiagnostics
} from '@/shared/diagnostics/client-runtime-diagnostics';

function RuntimeDebugOverlay() {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const snapshot = useSyncExternalStore(
    subscribeClientRuntimeDiagnostics,
    getClientRuntimeDiagnosticsSnapshot,
    getClientRuntimeDiagnosticsSnapshot
  );
  const lastEvent = snapshot.recentEvents[0] ?? null;
  const lastError = snapshot.lastError;

  const handleCopy = async () => {
    const text = formatClientRuntimeDiagnosticsForClipboard(snapshot);
    if (typeof navigator.clipboard?.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return;
    }

    recordClientRuntimeEvent('runtime-debug-overlay:copy-fallback', {
      reason: 'clipboard-api-unavailable'
    });
  };

  return (
    <div className="fixed bottom-3 left-3 z-50 max-w-[calc(100vw-24px)] rounded-2xl border border-slate-300 bg-white/95 shadow-xl backdrop-blur">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-semibold text-slate-900"
        onClick={() => setExpanded((current) => !current)}
      >
        <span>Debug {lastError ? `• ${lastError.clientErrorId.slice(0, 8)}` : ''}</span>
        <span>{expanded ? 'Hide' : 'Show'}</span>
      </button>

      {expanded ? (
        <div className="border-t border-slate-200 px-3 py-3 text-[11px] text-slate-700">
          <div className="space-y-1">
            <div><strong>{t('warehouse.field.floor')} route:</strong> {snapshot.currentRoute ?? 'unknown'}</div>
            <div><strong>viewport:</strong> {lastError?.viewport ? `${lastError.viewport.width}x${lastError.viewport.height}` : 'unknown'}</div>
            <div><strong>last event:</strong> {lastEvent ? `${lastEvent.name} @ ${lastEvent.recordedAt}` : 'none'}</div>
            <div><strong>last error:</strong> {lastError ? `${lastError.source}: ${lastError.message}` : 'none'}</div>
          </div>
          <button
            type="button"
            className="mt-3 rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-800"
            onClick={() => void handleCopy()}
          >
            {t('app.runtime.copyDiagnostics')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AppRouteRuntime() {
  const location = useLocation();
  const debugEnabled = new URLSearchParams(location.search).get('debug') === '1';

  useEffect(() => installGlobalClientRuntimeDiagnostics(), []);

  useEffect(() => {
    const route = `${location.pathname}${location.search}`;
    setClientRuntimeRoute(route);
    recordClientRuntimeEvent('route-change', { route });
  }, [location.pathname, location.search]);

  return debugEnabled ? <RuntimeDebugOverlay /> : null;
}
