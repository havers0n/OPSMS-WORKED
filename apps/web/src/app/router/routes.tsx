import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '@/app/layouts/app-shell';
import { ProtectedRoute } from '@/app/router/protected-route';
import { LoginPage } from '@/pages/login/ui/login-page';
import { OperationsPage } from '@/pages/operations/ui/operations-page';
import { OrderDetailPage } from '@/pages/order-detail/ui/order-detail-page';
import { ProductDetailPage } from '@/pages/product-detail/ui/product-detail-page';
import { PickTaskPage } from '@/pages/pick-task/ui/pick-task-page';
import { PickingQueuePage } from '@/pages/picking/ui/picking-queue-page';
import { PickingRunPage } from '@/pages/picking-run/ui/picking-run-page';
import { ProductsPage } from '@/pages/products/ui/products-page';
import { SettingsPage } from '@/pages/settings/ui/settings-page';
import { WaveDetailPage } from '@/pages/wave-detail/ui/wave-detail-page';
import { routes } from '@/shared/config/routes';
import { useT } from '@/shared/i18n';
import { warehouseViewModeActions } from '@/warehouse/state/view-mode';

const WarehouseApp = lazy(() => import('@/warehouse/app/warehouse-app'));

function PickingEntryRoute() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    warehouseViewModeActions.setViewStage('picking-plan');
    navigate(`${routes.warehouseView}${location.search}`, { replace: true });
  }, [navigate, location.search]);

  return null;
}

export function AppRouter() {
  const t = useT();

  return (
    <BrowserRouter>
      <Routes>
        <Route path={routes.login} element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route
            path={`${routes.warehouse}/*`}
            element={
              <Suspense
                fallback={
                  <div className="flex h-full w-full items-center justify-center text-sm text-[var(--text-muted)]">
                    {t('app.loading.warehouseWorkspace')}
                  </div>
                }
              >
                <WarehouseApp />
              </Suspense>
            }
          />
          <Route path={routes.products} element={<ProductsPage />} />
          <Route path={routes.productDetail} element={<ProductDetailPage />} />
          <Route path={routes.operations} element={<OperationsPage />} />
          <Route path={routes.picking} element={<PickingQueuePage />} />
          <Route path={routes.pickingPlan} element={<PickingEntryRoute />} />
          <Route path={routes.settings} element={<SettingsPage />} />
          <Route path={routes.orderDetail} element={<OrderDetailPage />} />
          <Route path={routes.waveDetail} element={<WaveDetailPage />} />
          <Route path={routes.pickTaskDetail} element={<PickTaskPage />} />
          <Route path={routes.tasks} element={<PickingQueuePage />} />
          <Route path={routes.pickingQueue} element={<Navigate to={routes.tasks} replace />} />
          <Route path={routes.pickingRun} element={<PickingRunPage />} />
          {/* Legacy redirects */}
          <Route path={routes.orders} element={<Navigate to={routes.operations} replace />} />
          <Route path={routes.waves} element={<Navigate to={routes.operations} replace />} />
          <Route path="*" element={<Navigate to={routes.warehouse} replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

