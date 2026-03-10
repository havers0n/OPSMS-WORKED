import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/app/layouts/app-shell';
import { ProtectedRoute } from '@/app/router/protected-route';
import { LoginPage } from '@/pages/login/ui/login-page';
import { OperationsPage } from '@/pages/operations/ui/operations-page';
import { ProductsPage } from '@/pages/products/ui/products-page';
import { WarehouseSetupPage } from '@/pages/warehouse-setup/ui/warehouse-setup-page';
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
          <Route path={routes.warehouse} element={<WarehouseSetupPage />} />
          <Route path={routes.products} element={<ProductsPage />} />
          <Route path={routes.operations} element={<OperationsPage />} />
          <Route path="*" element={<Navigate to={routes.warehouse} replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
