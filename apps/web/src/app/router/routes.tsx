import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/app/layouts/app-shell';
import { ProtectedRoute } from '@/app/router/protected-route';
import { LoginPage } from '@/pages/login/ui/login-page';
import { OrdersPage } from '@/pages/orders/ui/orders-page';
import { ProductsPage } from '@/pages/products/ui/products-page';
import { WavesPage } from '@/pages/waves/ui/waves-page';
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
          <Route path={routes.orders} element={<OrdersPage />} />
          <Route path={routes.operations} element={<OrdersPage />} />
          <Route path={routes.waves} element={<WavesPage />} />
          <Route path="*" element={<Navigate to={routes.warehouse} replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
