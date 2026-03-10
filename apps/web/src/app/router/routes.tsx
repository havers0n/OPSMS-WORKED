import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/app/layouts/app-shell';
import { OperationsPage } from '@/pages/operations/ui/operations-page';
import { WarehouseSetupPage } from '@/pages/warehouse-setup/ui/warehouse-setup-page';
import { routes } from '@/shared/config/routes';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path={routes.warehouse} element={<WarehouseSetupPage />} />
          <Route path={routes.operations} element={<OperationsPage />} />
          <Route path="*" element={<Navigate to={routes.operations} replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
