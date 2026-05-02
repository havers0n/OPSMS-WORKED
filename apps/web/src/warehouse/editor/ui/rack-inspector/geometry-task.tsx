import { useState } from 'react';
import type { Rack } from '@wos/domain';
import { GeneralTab } from '@/features/rack-configure/ui/general-tab';
import { GeometryBlueprint } from './geometry-blueprint';

export function GeometryTask({ rack, readOnly }: { rack: Rack; readOnly: boolean }) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      <GeometryBlueprint rack={rack} readOnly={readOnly} />
      <div className="rounded-[14px] border border-[var(--border-muted)] bg-white p-3 shadow-sm">
        <button
          type="button"
          data-testid="geometry-advanced-toggle"
          onClick={() => setIsAdvancedOpen((prev) => !prev)}
          className="w-full rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          {isAdvancedOpen ? 'Hide advanced geometry fields' : 'Show advanced geometry fields'}
        </button>
        {isAdvancedOpen && (
          <div data-testid="geometry-advanced-panel" className="mt-3">
            <GeneralTab rack={rack} readOnly={readOnly} />
          </div>
        )}
      </div>
    </div>
  );
}
