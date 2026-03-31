import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/app/layouts/app-shell';
import { ProtectedRoute } from '@/app/router/protected-route';
import { LoginPage } from '@/pages/login/ui/login-page';
import { OperationsPage } from '@/pages/operations/ui/operations-page';
import { PickTaskPage } from '@/pages/pick-task/ui/pick-task-page';
import { ProductsPage } from '@/pages/products/ui/products-page';
import { WaveDetailPage } from '@/pages/wave-detail/ui/wave-detail-page';
import { WarehouseSetupPage } from '@/pages/warehouse-setup/ui/warehouse-setup-page';
import { WarehouseViewPage } from '@/pages/warehouse-view/ui/warehouse-view-page';
import { routes } from '@/shared/config/routes';

export function AppRouter() {
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
          <Route path={routes.warehouseView} element={<WarehouseViewPage />} />
          <Route path={routes.warehouse} element={<WarehouseSetupPage />} />
          <Route path={routes.products} element={<ProductsPage />} />
          <Route path={routes.operations} element={<OperationsPage />} />
          <Route path={routes.waveDetail} element={<WaveDetailPage />} />
          <Route path={routes.pickTaskDetail} element={<PickTaskPage />} />
          {/* Legacy redirects */}
          <Route path={routes.orders} element={<Navigate to={routes.operations} replace />} />
          <Route path={routes.waves} element={<Navigate to={routes.operations} replace />} />
          <Route path="*" element={<Navigate to={routes.warehouse} replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
