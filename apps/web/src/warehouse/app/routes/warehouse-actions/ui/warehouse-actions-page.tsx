import { useNavigate } from 'react-router-dom';
import { useActiveFloorId } from '@/app/store/ui-selectors';
import { routes } from '@/shared/config/routes';
import { useT } from '@/shared/i18n';
import { WarehouseTopBar } from '@/warehouse/shell/ui/warehouse-top-bar';

export function WarehouseActionsPage() {
  const t = useT();
  const navigate = useNavigate();
  const activeFloorId = useActiveFloorId();

  const handleNavigateToLabels = () => {
    if (!activeFloorId) return;
    navigate(`${routes.warehouseLabels}?floorId=${activeFloorId}`);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <WarehouseTopBar />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-xl px-6 py-10">
          <h1 className="text-lg font-semibold text-slate-900">
            {t('warehouse.labels.actionsTitle')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('warehouse.labels.printDescription')}
          </p>

          <div className="mt-6">
            <button
              type="button"
              disabled={!activeFloorId}
              onClick={handleNavigateToLabels}
              className="flex w-full items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-start transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-cyan-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-900">
                  {t('warehouse.labels.printLocationLabels')}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {t('warehouse.labels.printDescription')}
                </span>
                {!activeFloorId && (
                  <span className="mt-1 block text-xs text-amber-600">
                    {t('warehouse.labels.noActiveFloor')}
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}