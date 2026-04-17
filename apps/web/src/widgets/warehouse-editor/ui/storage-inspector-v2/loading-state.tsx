import { InspectorFooter } from './shared';

export function LoadingState() {
  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden">
      <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
        <p className="text-sm text-gray-400">Loading location…</p>
      </div>
      <InspectorFooter />
    </div>
  );
}
