import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { WarehouseSetupPage } from '@/warehouse/app/routes/warehouse-setup/ui/warehouse-setup-page';
import { WarehouseViewPage } from '@/warehouse/app/routes/warehouse-view/ui/warehouse-view-page';
import { routes } from '@/shared/config/routes';
import { ensureWarehouseEditorSessionCleanupRegistered } from '@/widgets/warehouse-editor/model/session-cleanup';

export default function WarehouseApp() {
  useEffect(() => {
    ensureWarehouseEditorSessionCleanupRegistered();
  }, []);

  return (
    <Routes>
      <Route index element={<WarehouseSetupPage />} />
      <Route path="view" element={<WarehouseViewPage />} />
      <Route path="*" element={<Navigate to={routes.warehouse} replace />} />
    </Routes>
  );
}
