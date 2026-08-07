import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Soft reset without full page reload */
  fallbackTitle?: string;
};

type State = {
  hasError: boolean;
  error?: Error;
};

/**
 * Route-level boundary — one page crash should not kill the whole dashboard shell.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  private reset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-xl font-bold text-rose-600">
              !
            </div>
            <h1 className="mb-2 text-lg font-bold text-slate-900">
              {this.props.fallbackTitle || 'Halaman mengalami kesalahan'}
            </h1>
            <p className="mb-6 text-sm text-slate-500">
              {this.state.error?.message || 'Komponen gagal dirender. Coba muat ulang bagian ini.'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={this.reset}
                className="flex-1 cursor-pointer rounded-xl bg-primary-600 py-2.5 text-sm font-bold text-white hover:bg-primary-700"
              >
                Coba Lagi
              </button>
              <button
                type="button"
                onClick={() => window.location.assign('/dashboard')}
                className="flex-1 cursor-pointer rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100"
              >
                Ke Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
