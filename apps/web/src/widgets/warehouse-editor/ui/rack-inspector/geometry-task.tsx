import type { Rack } from '@wos/domain';
import { GeneralTab } from '@/features/rack-configure/ui/general-tab';

export function GeometryTask({ rack, readOnly }: { rack: Rack; readOnly: boolean }) {
  return (
    <div className="px-5 py-5">
      <GeneralTab rack={rack} readOnly={readOnly} />
    </div>
  );
}
