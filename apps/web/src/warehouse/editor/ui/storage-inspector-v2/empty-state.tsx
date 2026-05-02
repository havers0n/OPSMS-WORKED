import { EmptyState as SharedEmptyState } from '@/shared/ui/empty-state';
import { InspectorFooter, inspectorShellClassName } from './shared';

export function EmptyState() {
  return (
    <div className={inspectorShellClassName}>
      <SharedEmptyState
        title="No location selected"
        description="Select a location from the navigator to view details"
        icon={
          <svg
            className="h-6 w-6 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        }
      />
      <InspectorFooter />
    </div>
  );
}
