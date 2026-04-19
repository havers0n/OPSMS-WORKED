import { Menu } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useActiveFloorId, useIsDrawerCollapsed, useToggleDrawer } from '@/app/store/ui-selectors';
import { useFloorWorkspace } from '@/entities/layout-version/api/use-floor-workspace';
import { useLayoutValidation } from '@/features/layout-validate/model/use-layout-validation';
import { IconButton } from '@/shared/ui/icon-button';
import { TopBarShell } from '@/shared/ui/top-bar-shell';
import {
  useDraftDirtyState,
  useDraftPersistenceStatus,
  useLayoutDraftState,
  useViewMode
} from '@/widgets/warehouse-editor/model/editor-selectors';
import { AccountControls } from './account-controls';
import { ViewModeSwitcher } from './view-mode-switcher';
import { WorkspaceActions } from './workspace-actions';
import { WorkspaceNav } from './workspace-nav';
import { WorkspaceStatus } from './workspace-status';

export function TopBar() {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const toggle = useToggleDrawer();
  const isCollapsed = useIsDrawerCollapsed();

  const activeFloorId = useActiveFloorId();
  const viewMode = useViewMode();
  const layoutDraft = useLayoutDraftState();
  const isDraftDirty = useDraftDirtyState();
  const persistenceStatus = useDraftPersistenceStatus();
  const workspaceQuery = useFloorWorkspace(activeFloorId);
  const latestPublished = workspaceQuery.data?.latestPublished ?? null;
  const persistedDraftValidation = useLayoutValidation(layoutDraft?.layoutVersionId ?? null).cachedResult;

  const hasDraftLayout = layoutDraft?.state === 'draft';

  const issueSummary = useMemo(() => {
    // Published state is already communicated by the breadcrumb badge and
    // the PublishedBanner below the TopBar — no need to repeat it here.
    if (!layoutDraft && latestPublished) return null;
    if (layoutDraft?.state === 'published') return null;
    if (isDraftDirty) return 'Draft changed';
    if (!persistedDraftValidation) return null;
    return persistedDraftValidation.isValid
      ? 'Valid'
      : `${persistedDraftValidation.issues.length} issue(s)`;
  }, [isDraftDirty, latestPublished, layoutDraft, persistedDraftValidation]);

  // Clear any explicit action feedback the moment the draft becomes dirty so that
  // ambient state labels (e.g. "Draft changed") are never hidden by a stale message.
  useEffect(() => {
    if (isDraftDirty) setStatusMessage(null);
  }, [isDraftDirty]);

  // Explicit action feedback (statusMessage) takes priority over computed ambient
  // state (issueSummary) so that targeted messages like a specific validation error
  // are not overridden by the generic issue count derived from the cached result.
  const inlineStatusMessage = statusMessage ?? issueSummary;

  const workspaceStateLabel = !hasDraftLayout
    ? 'Published'
    : viewMode !== 'layout'
      ? 'Read-only'
      : persistenceStatus === 'dirty'
        ? 'Unsaved'
        : persistenceStatus === 'saving'
          ? 'Saving...'
          : persistenceStatus === 'conflict'
            ? 'Conflict'
            : persistenceStatus === 'error'
              ? 'Save failed'
              : 'Saved';

  const isCurrentModeLocked = viewMode !== 'layout' || !hasDraftLayout;
  const workspaceStateStyle = isCurrentModeLocked
    ? { background: 'rgba(37,99,235,0.12)', color: '#1d4ed8' }
    : persistenceStatus === 'dirty'
      ? { background: 'rgba(183,121,31,0.12)', color: 'var(--warning)' }
      : persistenceStatus === 'saving'
        ? { background: 'rgba(37,99,235,0.12)', color: '#1d4ed8' }
        : persistenceStatus === 'conflict' || persistenceStatus === 'error'
          ? { background: 'rgba(220,38,38,0.12)', color: '#b91c1c' }
          : { background: 'rgba(20,125,100,0.1)', color: 'var(--success)' };

  const workspaceTooltip = !hasDraftLayout
    ? 'Structure locked · switch to Layout and create a draft to edit'
    : viewMode !== 'layout'
      ? 'Read-only in View/Storage · switch to Layout to edit structure'
      : null;

  return (
    <TopBarShell
      className="shrink-0 [&>div]:h-11"
      style={{
        background: 'var(--surface-primary)'
      }}
      left={
        <div className="flex h-full items-center">
          <div
            className="flex h-full items-center gap-2 border-r px-3"
            style={{ borderColor: 'var(--border-muted)' }}
          >
            <IconButton
              icon={<Menu className="h-4 w-4" />}
              onClick={toggle}
              title={isCollapsed ? 'Open navigation' : 'Close navigation'}
              className="rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            />
            <span className="text-[11px] font-black tracking-widest" style={{ color: 'var(--accent)' }}>
              W
            </span>
            <span className="text-sm font-semibold text-slate-700">Warehouse Ops</span>
          </div>

          <WorkspaceNav
            onContextSwitched={() => setStatusMessage(null)}
            statusBadge={
              <WorkspaceStatus
                variant="badge"
                label={workspaceStateLabel}
                isCurrentModeLocked={isCurrentModeLocked}
                style={workspaceStateStyle}
                tooltip={workspaceTooltip}
              />
            }
          />
        </div>
      }
      center={<ViewModeSwitcher />}
      right={
        <div className="flex h-full items-center">
          <div
            className="flex h-full items-center gap-1 border-l px-3"
            style={{ borderColor: 'var(--border-muted)' }}
          >
            <WorkspaceStatus variant="inline" message={inlineStatusMessage} />
            <WorkspaceActions onStatusMessageChange={setStatusMessage} />
          </div>

          <AccountControls />
        </div>
      }
    />
  );
}
