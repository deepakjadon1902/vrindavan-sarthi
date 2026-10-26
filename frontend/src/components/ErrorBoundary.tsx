import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[60vh] flex items-center justify-center px-4 py-16 bg-[#fdfcf9]">
          <div className="max-w-md w-full rounded-3xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-800 mb-4">
              <AlertCircle size={28} />
            </div>
            <h2 className="font-heading text-xl font-bold text-slate-900">
              Unable to display this page
            </h2>
            <p className="font-body text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
              We encountered a temporary rendering issue. Please reload the page or return to the main listings.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={this.handleReset}
                className="btn-emerald inline-flex items-center justify-center gap-1.5 w-full sm:w-auto rounded-full px-5 py-2.5 text-xs font-bold shadow-sm"
              >
                <RefreshCw size={14} />
                <span>Reload Page</span>
              </button>
              <a
                href="/"
                className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto rounded-full border border-neutral-300 bg-white px-5 py-2.5 font-body text-xs font-semibold text-slate-800 hover:bg-neutral-50 transition-colors"
              >
                <ArrowLeft size={14} />
                <span>Go to Home</span>
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
