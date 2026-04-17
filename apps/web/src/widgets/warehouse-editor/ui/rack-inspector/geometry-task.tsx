import type { Rack } from '@wos/domain';
import { GeneralTab } from '@/features/rack-configure/ui/general-tab';
import { GeometryBlueprint } from './geometry-blueprint';

export function GeometryTask({ rack, readOnly }: { rack: Rack; readOnly: boolean }) {
  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      <GeometryBlueprint rack={rack} />
      <GeneralTab rack={rack} readOnly={readOnly} />
    </div>
  );
}
