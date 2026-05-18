import type { FloorWorkspace } from '@wos/domain';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Panel } from '@/shared/ui/panel';
import { useEditorSelection } from '@/warehouse/editor/model/editor-selectors';
import { ViewInspectorSurface } from './view-inspector-surface';
import { hasInspectableViewSelection } from './view-inspector-router-logic';

const VIEW_PANEL_WIDTH = 'min(400px, 100vw)';
const MOBILE_BREAKPOINT_PX = 640;

type MobileSheetMode = 'peek' | 'expanded';

type ViewSidePanelSlotProps = {
  workspace: FloorWorkspace | null;
  onCloseInspector: () => void;
};

function getIsMobileViewport() {
  if (typeof window === 'undefined') return false;
  if (window.innerWidth === 0) return false;
  return window.innerWidth < MOBILE_BREAKPOINT_PX;
}

function useIsMobileViewport() {
  const [isMobileViewport, setIsMobileViewport] = useState(getIsMobileViewport);

  useEffect(() => {
    const update = () => setIsMobileViewport(getIsMobileViewport());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return isMobileViewport;
}

export function ViewSidePanelSlot({
  workspace,
  onCloseInspector
}: ViewSidePanelSlotProps) {
  const selection = useEditorSelection();
  const isOpen = hasInspectableViewSelection(selection);
  const isMobileViewport = useIsMobileViewport();
  const [mobileSheetMode, setMobileSheetMode] = useState<MobileSheetMode>('peek');

  useEffect(() => {
    if (!isOpen) {
      setMobileSheetMode('peek');
    }
  }, [isOpen]);

  if (isMobileViewport) {
    const isExpanded = mobileSheetMode === 'expanded';

    return (
      <div
        data-testid="view-side-panel-slot"
        className="contents"
        style={{ width: '0px' }}
      >
        {isOpen && isExpanded ? (
          <div
            className="fixed inset-0 z-10 bg-black/20 sm:hidden"
            aria-hidden="true"
            onClick={() => setMobileSheetMode('peek')}
          />
        ) : null}

        {isOpen ? (
          <div
            data-testid="view-mobile-inspector-sheet"
            className={[
              'fixed inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.10)] sm:hidden',
              'transition-[height] duration-300 ease-in-out',
              isExpanded ? 'h-[90vh]' : 'h-[42vh]'
            ].join(' ')}
          >
            <div className="flex shrink-0 items-center justify-between px-3 pb-1 pt-2">
              <div className="w-6" />
              <button
                type="button"
                className="flex flex-1 items-center justify-center py-2 focus-visible:outline-none"
                onClick={() => setMobileSheetMode(isExpanded ? 'peek' : 'expanded')}
                aria-label={isExpanded ? 'Collapse view inspector' : 'Expand view inspector'}
                aria-expanded={isExpanded}
              >
                <span className="h-1 w-10 rounded-full bg-slate-300" />
              </button>
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center text-slate-400 hover:text-slate-600"
                onClick={onCloseInspector}
                aria-label="Close view inspector"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <ViewInspectorSurface
                workspace={workspace}
                onClose={onCloseInspector}
              />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      data-testid="view-side-panel-slot"
      className="shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out"
      style={{ width: isOpen ? VIEW_PANEL_WIDTH : '0px' }}
    >
      <Panel
        padding="none"
        tone="default"
        className="h-full overflow-hidden rounded-none border-y-0 border-r-0 transition-transform duration-300 ease-in-out"
        style={{
          width: VIEW_PANEL_WIDTH,
          borderColor: 'var(--border-muted)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)'
        }}
      >
        {isOpen ? (
          <ViewInspectorSurface
            workspace={workspace}
            onClose={onCloseInspector}
          />
        ) : null}
      </Panel>
    </div>
  );
}
