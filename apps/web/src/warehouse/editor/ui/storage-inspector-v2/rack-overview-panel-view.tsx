import { RackStatusSummary, type RackStatusSummaryProps } from '@/entities/rack/ui/rack-status-summary';
import { useT } from '@/shared/i18n';
import {
  inspectorBodyPaddingClassName,
  inspectorScrollBodyClassName,
  inspectorShellClassName,
  InspectorFooter
} from './shared';

export type RackOverviewPanelViewProps =
  | {
      status: 'loading';
      loadingText?: string;
    }
  | {
      status: 'error';
      errorText?: string;
    }
  | {
      status: 'empty';
      emptyText?: string;
    }
  | {
      status: 'ready';
      summary: RackStatusSummaryProps;
      activeLevel?: number | null;
      onLevelSelect?: (level: number) => void;
    };

export function RackOverviewPanelView(props: RackOverviewPanelViewProps) {
  const t = useT();

  if (props.status === 'loading') {
    return (
      <div className={inspectorShellClassName}>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="text-sm text-gray-400">{props.loadingText ?? t('storage.state.loadingRack')}</p>
        </div>
        <InspectorFooter />
      </div>
    );
  }

  if (props.status === 'error') {
    return (
      <div className={inspectorShellClassName}>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="text-sm text-red-500">{props.errorText ?? t('storage.state.failedRack')}</p>
        </div>
        <InspectorFooter />
      </div>
    );
  }

  if (props.status === 'empty') {
    return (
      <div className={inspectorShellClassName}>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="text-sm text-gray-400">{props.emptyText ?? t('storage.state.selectRack')}</p>
        </div>
        <InspectorFooter />
      </div>
    );
  }

  return (
    <div className={inspectorShellClassName}>
      <div className={inspectorScrollBodyClassName}>
        <div className={inspectorBodyPaddingClassName}>
          <RackStatusSummary
            displayCode={props.summary.displayCode}
            kind={props.summary.kind}
            axis={props.summary.axis}
            activeLevel={props.activeLevel}
            occupancySummary={props.summary.occupancySummary}
            levels={props.summary.levels}
            onLevelSelect={props.onLevelSelect}
          />
        </div>
      </div>

      <InspectorFooter />
    </div>
  );
}
