import { InspectorFooter, inspectorShellClassName } from './shared';

export function LoadingState() {
  return (
    <div className={inspectorShellClassName}>
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <p className="text-sm text-gray-400">Loading location...</p>
      </div>
      <InspectorFooter />
    </div>
  );
}
