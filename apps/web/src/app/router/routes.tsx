import { Suspense, lazy, useEffect } from 'react';
const LoginPage = lazy(() => import('@/pages/login/ui/login-page').then(m => ({ default: m.LoginPage })));
const ManualOperatorPage = lazy(() => import('@/pages/manual-operator/ui/manual-operator-page').then(m => ({ default: m.ManualOperatorPage })));
const OperationsPage = lazy(() => import('@/pages/operations/ui/operations-page').then(m => ({ default: m.OperationsPage })));
const OrderDetailPage = lazy(() => import('@/pages/order-detail/ui/order-detail-page').then(m => ({ default: m.OrderDetailPage })));
const ProductDetailPage = lazy(() => import('@/pages/product-detail/ui/product-detail-page').then(m => ({ default: m.ProductDetailPage })));
const PickTaskPage = lazy(() => import('@/pages/pick-task/ui/pick-task-page').then(m => ({ default: m.PickTaskPage })));
const PickingQueuePage = lazy(() => import('@/pages/picking/ui/picking-queue-page').then(m => ({ default: m.PickingQueuePage })));

const ProductsPage = lazy(() => import('@/pages/products/ui/products-page').then(m => ({ default: m.ProductsPage })));
const SettingsPage = lazy(() => import('@/pages/settings/ui/settings-page').then(m => ({ default: m.SettingsPage })));
const WaveDetailPage = lazy(() => import('@/pages/wave-detail/ui/wave-detail-page').then(m => ({ default: m.WaveDetailPage })));
const MobilePickerPage = lazy(() => import('@/pages/picker/picker-page').then(m => ({ default: m.PickerPage })));
const MobilePickTaskPage = lazy(() => import('@/pages/picker/pick-task-page').then(m => ({ default: m.PickTaskPage })));
const MobilePickStepPage = lazy(() => import('@/pages/picker/pick-step-page').then(m => ({ default: m.PickStepPage })));
const PrintSchemePage = lazy(() => import('@/pages/manual-operator/printing/routes/PrintSchemePage').then(m => ({ default: m.PrintSchemePage })));
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppRouteErrorBoundary } from '@/app/diagnostics/app-route-error-boundary';
import { AppRouteRuntime } from '@/app/diagnostics/app-route-runtime';
import { AppShell } from '@/app/layouts/app-shell';
import { ProtectedRoute } from '@/app/router/protected-route';
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
      <AppRouteRuntime />
      <AppRouteErrorBoundary>
        <Routes>
        <Route path={routes.login} element={<LoginPage />} />
        {/*
          Picker routes (MVP): protected by existing Supabase app auth.
          Worker identity is supplied via ?workerId= query param for now.
          TODO: replace ?workerId= with auth.uid() → manual_shift_workers.auth_user_id
          resolution (or a PIN/QR session) in a follow-up PR.
        */}
        <Route
          path={routes.picker}
          element={
            <ProtectedRoute>
              <Suspense fallback={<div className="flex h-full w-full items-center justify-center text-sm text-[var(--text-muted)]">{t('app.loading.session')}</div>}>
                <MobilePickerPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path={routes.pickerTask}
          element={
            <ProtectedRoute>
              <Suspense fallback={<div className="flex h-full w-full items-center justify-center text-sm text-[var(--text-muted)]">{t('app.loading.session')}</div>}>
                <MobilePickTaskPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path={routes.pickerStep}
          element={
            <ProtectedRoute>
              <Suspense fallback={<div className="flex h-full w-full items-center justify-center text-sm text-[var(--text-muted)]">{t('app.loading.session')}</div>}>
                <MobilePickStepPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path={routes.operatorManualPrintScheme}
          element={
            <ProtectedRoute>
              <PrintSchemePage />
            </ProtectedRoute>
          }
        />
        <Route
          path={routes.operatorManual}
          element={<Navigate to={routes.operatorManualWork} replace />}
        />
        <Route
          path={`${routes.operatorManual}/*`}
          element={
            <ProtectedRoute>
              <Suspense fallback={<div className="flex h-full w-full items-center justify-center text-sm text-[var(--text-muted)]">{t('app.loading.session')}</div>}>
                <ManualOperatorPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
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
          <Route path={routes.products} element={<Suspense fallback={<div className="flex items-center justify-center text-sm text-[var(--text-muted)]">{t('app.loading.session')}</div>}><ProductsPage /></Suspense>} />
          <Route path={routes.productDetail} element={<Suspense fallback={<div className="flex items-center justify-center text-sm text-[var(--text-muted)]">{t('app.loading.session')}</div>}><ProductDetailPage /></Suspense>} />
          <Route path={routes.operations} element={<Suspense fallback={<div className="flex items-center justify-center text-sm text-[var(--text-muted)]">{t('app.loading.session')}</div>}><OperationsPage /></Suspense>} />
          <Route path={routes.picking} element={<Navigate to={routes.tasks} replace />} />
          <Route path={routes.pickingPlan} element={<PickingEntryRoute />} />
          <Route path={routes.settings} element={<Suspense fallback={<div className="flex items-center justify-center text-sm text-[var(--text-muted)]">{t('app.loading.session')}</div>}><SettingsPage /></Suspense>} />
          <Route path={routes.orderDetail} element={<Suspense fallback={<div className="flex items-center justify-center text-sm text-[var(--text-muted)]">{t('app.loading.session')}</div>}><OrderDetailPage /></Suspense>} />
          <Route path={routes.waveDetail} element={<Suspense fallback={<div className="flex items-center justify-center text-sm text-[var(--text-muted)]">{t('app.loading.session')}</div>}><WaveDetailPage /></Suspense>} />
          <Route path={routes.pickTaskDetail} element={<Suspense fallback={<div className="flex items-center justify-center text-sm text-[var(--text-muted)]">{t('app.loading.session')}</div>}><PickTaskPage /></Suspense>} />
          <Route path={routes.tasks} element={<Suspense fallback={<div className="flex items-center justify-center text-sm text-[var(--text-muted)]">{t('app.loading.session')}</div>}><PickingQueuePage /></Suspense>} />
          <Route path={routes.pickingRun} element={<Navigate to={routes.tasks} replace />} />
          {/* Legacy redirects */}
          <Route path={routes.orders} element={<Navigate to={routes.operations} replace />} />
          <Route path={routes.waves} element={<Navigate to={routes.operations} replace />} />
          <Route path="*" element={<Navigate to={routes.warehouse} replace />} />
        </Route>
        </Routes>
      </AppRouteErrorBoundary>
    </BrowserRouter>
  );
}

