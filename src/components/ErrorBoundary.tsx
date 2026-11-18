import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application ErrorBoundary caught error:', error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    let parsedDetails: {
      error?: string;
      operationType?: string;
      path?: string;
      authInfo?: { email?: string | null; emailVerified?: boolean | null; userId?: string | null };
    } | null = null;
    try {
      const parsed = JSON.parse(this.state.message);
      if (parsed && typeof parsed === 'object' && 'error' in parsed) {
        parsedDetails = parsed;
      }
    } catch {
      parsedDetails = null;
    }

    const displayMessage = parsedDetails?.error || this.state.message;
    const isQuotaError = displayMessage.includes('Quota exceeded');

    return (
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center shrink-0 text-red-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-base font-bold text-slate-900">
                {isQuotaError ? 'Database Quota Reached' : 'Database / Application Error'}
              </h1>
              <p className="text-sm text-slate-600 mt-1 break-words">{displayMessage}</p>
              {parsedDetails?.path && (
                <p className="text-xs font-mono-tabular text-slate-500 mt-1.5">
                  {parsedDetails.operationType?.toUpperCase()} · {parsedDetails.path}
                </p>
              )}
              {parsedDetails?.authInfo?.email && (
                <p className="text-xs text-slate-500 mt-1">
                  Account: {parsedDetails.authInfo.email}
                </p>
              )}
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
