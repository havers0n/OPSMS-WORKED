import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import {
  formatClientRuntimeDiagnosticsForClipboard,
  getClientRuntimeDiagnosticsSnapshot,
  reportClientRuntimeError
} from '@/shared/diagnostics/client-runtime-diagnostics';
import { useT } from '@/shared/i18n';

type ErrorBoundaryState = {
  errorId: string | null;
  message: string | null;
};

class RouteErrorBoundaryImpl extends Component<
  {
    children: ReactNode;
    route: string;
    title: string;
    description: string;
    copyLabel: string;
  },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    errorId: null,
    message: null
  };

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = reportClientRuntimeError({
      source: 'react-error-boundary',
      message: error.message,
      stack: error.stack ?? null,
      componentStack: errorInfo.componentStack,
      context: {
        route: this.props.route
      }
    });

    this.setState({
      errorId,
      message: error.message
    });
  }

  private readonly handleCopy = async () => {
    const text = formatClientRuntimeDiagnosticsForClipboard(
      getClientRuntimeDiagnosticsSnapshot()
    );

    if (typeof navigator.clipboard?.writeText === 'function') {
      await navigator.clipboard.writeText(text);
    }
  };

  override render() {
    if (this.state.errorId !== null) {
      return (
        <div className="flex h-full min-h-[40vh] w-full items-center justify-center px-4">
          <div className="max-w-md rounded-3xl border border-rose-200 bg-white p-6 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{this.props.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{this.props.description}</p>
            <p className="mt-3 font-mono text-xs text-rose-700">{this.state.errorId}</p>
            <p className="mt-2 text-xs text-slate-500">{this.state.message}</p>
            <button
              type="button"
              className="mt-4 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900"
              onClick={() => void this.handleCopy()}
            >
              {this.props.copyLabel}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function AppRouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  const t = useT();
  const route = `${location.pathname}${location.search}`;

  return (
    <RouteErrorBoundaryImpl
      key={route}
      route={route}
      title={t('app.runtime.errorTitle')}
      description={t('app.runtime.errorDescription')}
      copyLabel={t('app.runtime.copyDiagnostics')}
    >
      {children}
    </RouteErrorBoundaryImpl>
  );
}
