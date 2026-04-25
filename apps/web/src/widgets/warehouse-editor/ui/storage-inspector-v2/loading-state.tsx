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

export function LoadingErrorState({
  title,
  message,
  onRetry
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className={inspectorShellClassName}>
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <p className="text-sm font-semibold text-gray-700">{title}</p>
        <p className="mt-2 text-sm text-gray-500">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-sm border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Retry
        </button>
      </div>
      <InspectorFooter />
    </div>
  );
}
