import { Suspense, useEffect, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { WarehouseSetupPage } from '@/warehouse/app/routes/warehouse-setup/ui/warehouse-setup-page';
import { WarehouseViewPage } from '@/warehouse/app/routes/warehouse-view/ui/warehouse-view-page';
import { ensureWarehouseEditorSessionCleanupRegistered } from '@/warehouse/state/editor-session';
import { routes } from '@/shared/config/routes';
import { useT } from '@/shared/i18n';

const WarehouseActionsPage = lazy(() => import('@/warehouse/app/routes/warehouse-actions/ui/warehouse-actions-page').then(m => ({ default: m.WarehouseActionsPage })));
const WarehouseLabelsPage = lazy(() => import('@/warehouse/app/routes/warehouse-labels/ui/warehouse-labels-page').then(m => ({ default: m.WarehouseLabelsPage })));

export default function WarehouseApp() {
  const t = useT();
  const fallback = (
    <div className="flex h-full w-full items-center justify-center text-sm text-[var(--text-muted)]">
      {t('app.loading.warehouseWorkspace')}
    </div>
  );

  useEffect(() => {
    ensureWarehouseEditorSessionCleanupRegistered();
  }, []);

  return (
    <Routes>
      <Route index element={<WarehouseSetupPage />} />
      <Route path="view" element={<WarehouseViewPage />} />
      <Route path="actions" element={<Suspense fallback={fallback}><WarehouseActionsPage /></Suspense>} />
      <Route path="labels" element={<Suspense fallback={fallback}><WarehouseLabelsPage /></Suspense>} />
      <Route path="*" element={<Navigate to={routes.warehouse} replace />} />
    </Routes>
  );
}
