import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/app/layouts/app-shell';
import { WarehouseSetupPage } from '@/pages/warehouse-setup/ui/warehouse-setup-page';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/warehouse" element={<WarehouseSetupPage />} />
          <Route path="*" element={<Navigate to="/warehouse" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
