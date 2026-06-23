import type { BucketProductRollupRow, ManualShiftSession } from '@wos/domain';
import type {
  AreaHierarchySummary,
  LineHierarchySummary,
  OrderDetail,
  RouteGroupSummary,
  RouteGroupWorkBucketSummary,
  WorkBucketSummary,
  ShiftSummary
} from '@/entities/manual-shift/model/shift-selectors';
import { DesktopDetailDrawer } from './desktop-detail-drawer';
import { DesktopEmptyState } from './desktop-empty-state';
import { DesktopHierarchyPanel } from './desktop-hierarchy-panel';

export interface DesktopOperatorShellProps {
  shift: ManualShiftSession | null;
  isLoading: boolean;
  kpi: ShiftSummary | undefined;
  orderDetail: OrderDetail | null;
  selectedDetailType: 'order' | null;
  selectedAreaKey: string | null;
  selectedAreaLineKey?: string | null;
  selectedLineId?: string | null;
  selectedRouteGroupKey: string | null;
  selectedWorkBucketKey: string | null;
  selectedRouteGroupWorkBucket: RouteGroupWorkBucketSummary | undefined;
  selectedWorkBucketName: string | null;
  areaSummaries: AreaHierarchySummary[];
  specialAreaSummaries: AreaHierarchySummary[];
  lineHierarchySummaries: LineHierarchySummary[];
  areaLineSummaries: LineHierarchySummary[];
  workBucketSummaries: WorkBucketSummary[];
  routeGroupSummaries: RouteGroupSummary[];
  routeGroupWorkBucketSummaries: RouteGroupWorkBucketSummary[];
  hasRouteGroups: boolean;
  showProductRollupDeferred: boolean;
  onSelectOrder: (orderId: string) => void;
  onCloseDetail: () => void;
  onSelectArea: (areaName: string | null) => void;
  onSelectHierarchyLine: (areaLineKey: string) => void;
  onSelectHierarchyRouteGroup: (routeGroupKey: string) => void;
  onSelectHierarchyBucket: (workBucketIdentifier: string) => void;
  onClearArea: () => void;
  onClearHierarchyLine: () => void;
  onClearHierarchyRouteGroup: () => void;
  onClearHierarchyBucket: () => void;
  workBucketView: 'products' | 'orders';
  productRollup: BucketProductRollupRow[] | undefined;
  productRollupLoading: boolean;
  onSetWorkBucketView: (view: 'products' | 'orders') => void;
  onCreateShift: () => void;
  isCreatingShift: boolean;
}

function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4 p-6 animate-pulse" aria-label="טוען נתונים">
      <div className="flex gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-14 w-16 rounded-lg bg-gray-200" />
        ))}
      </div>
      <div className="flex flex-1 gap-px">
        <div className="flex-1 rounded bg-gray-100" />
        <div className="w-72 rounded bg-gray-100" />
      </div>
    </div>
  );
}

export function DesktopOperatorShell({
  shift,
  isLoading,
  orderDetail,
  selectedDetailType,
  selectedAreaKey,
  selectedAreaLineKey,
  selectedLineId,
  selectedRouteGroupKey,
  selectedWorkBucketKey,
  selectedRouteGroupWorkBucket,
  selectedWorkBucketName,
  areaSummaries,
  specialAreaSummaries,
  lineHierarchySummaries,
  areaLineSummaries,
  workBucketSummaries,
  routeGroupSummaries,
  routeGroupWorkBucketSummaries,
  hasRouteGroups,
  showProductRollupDeferred,
  onSelectOrder,
  onCloseDetail,
  onSelectArea,
  onSelectHierarchyLine,
  onSelectHierarchyRouteGroup,
  onSelectHierarchyBucket,
  onClearArea,
  onClearHierarchyLine,
  onClearHierarchyRouteGroup,
  onClearHierarchyBucket,
  workBucketView,
  productRollup,
  productRollupLoading,
  onSetWorkBucketView,
  onCreateShift,
  isCreatingShift
}: DesktopOperatorShellProps) {
  if (isLoading) {
    return (
      <div className="flex h-full flex-col bg-gray-50" dir="rtl">
        <LoadingSkeleton />
      </div>
    );
  }

  const drawerState =
    selectedDetailType === 'order'
      ? { type: 'order' as const, detail: orderDetail }
      : null;

  return (
    <div className="flex h-full flex-col bg-gray-100 overflow-hidden" dir="rtl">
      {!shift ? (
        <div className="flex flex-1 bg-gray-50">
          <DesktopEmptyState onCreateShift={onCreateShift} isCreating={isCreatingShift} />
        </div>
      ) : (
        <div className="flex flex-1 gap-px overflow-hidden">
          <main className="min-w-0 flex-1 overflow-y-auto bg-white">
            <DesktopHierarchyPanel
              selectedAreaKey={selectedAreaKey}
              selectedAreaLineKey={selectedAreaLineKey}
              selectedLineId={selectedLineId}
              selectedRouteGroupKey={selectedRouteGroupKey}
              selectedWorkBucketKey={selectedWorkBucketKey}
              selectedRouteGroupWorkBucket={selectedRouteGroupWorkBucket}
              selectedWorkBucketName={selectedWorkBucketName}
              areaSummaries={areaSummaries}
              specialAreaSummaries={specialAreaSummaries}
              lineHierarchySummaries={lineHierarchySummaries}
              areaLineSummaries={areaLineSummaries}
              workBucketSummaries={workBucketSummaries}
              routeGroupSummaries={routeGroupSummaries}
              routeGroupWorkBucketSummaries={routeGroupWorkBucketSummaries}
              hasRouteGroups={hasRouteGroups}
              shiftId={shift.id}
              showProductRollupDeferred={showProductRollupDeferred}
              onSelectArea={onSelectArea}
              onSelectLine={onSelectHierarchyLine}
              onSelectRouteGroup={onSelectHierarchyRouteGroup}
              onSelectBucket={onSelectHierarchyBucket}
              onSelectOrder={onSelectOrder}
              onClearArea={onClearArea}
              onClearLine={onClearHierarchyLine}
              onClearRouteGroup={onClearHierarchyRouteGroup}
              onClearBucket={onClearHierarchyBucket}
              workBucketView={workBucketView}
              productRollup={productRollup}
              productRollupLoading={productRollupLoading}
              onSetWorkBucketView={onSetWorkBucketView}
            />
          </main>

          <DesktopDetailDrawer
            state={drawerState}
            onClose={onCloseDetail}
            onSelectOrder={onSelectOrder}
          />
        </div>
      )}
    </div>
  );
}
