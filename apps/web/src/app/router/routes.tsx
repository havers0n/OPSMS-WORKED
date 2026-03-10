import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/app/layouts/app-shell';
import { WarehouseSetupPage } from '@/pages/warehouse-setup/ui/warehouse-setup-page';
import { ProductsPage } from '@/pages/products/ui/products-page';
import { routes } from '@/shared/config/routes';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path={routes.warehouse} element={<WarehouseSetupPage />} />
          <Route path={routes.products} element={<ProductsPage />} />
          <Route path="*" element={<Navigate to={routes.warehouse} replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
