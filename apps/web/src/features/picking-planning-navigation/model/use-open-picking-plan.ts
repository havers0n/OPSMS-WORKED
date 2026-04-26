import { useNavigate } from 'react-router-dom';
import { usePickingPlanningOverlayStore } from '@/entities/picking-planning/model/overlay-store';
import { routes } from '@/shared/config/routes';
import {
  useSetViewMode,
  useSetViewStage
} from '@/widgets/warehouse-editor/model/editor-selectors';

export function useOpenPickingPlan() {
  const navigate = useNavigate();
  const setSource = usePickingPlanningOverlayStore((state) => state.setSource);
  const setViewMode = useSetViewMode();
  const setViewStage = useSetViewStage();

  return {
    openForOrder(orderId: string) {
      setSource({ kind: 'orders', orderIds: [orderId] });
      setViewMode('view');
      setViewStage('picking-plan');
      navigate(routes.warehouseView);
    },
    openForWave(waveId: string) {
      setSource({ kind: 'wave', waveId });
      setViewMode('view');
      setViewStage('picking-plan');
      navigate(routes.warehouseView);
    }
  };
}
