import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled Application Exception caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    try {
      localStorage.removeItem('pr_search_recent');
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  private copyDiagnostics = () => {
    const text = `Pushpa Raj Automotive Error Log:\nTime: ${new Date().toISOString()}\nError: ${this.state.error?.message}\nStack: ${this.state.error?.stack}\nComponent: ${this.state.errorInfo?.componentStack}`;
    navigator.clipboard.writeText(text);
    alert('Diagnostic report copied to clipboard.');
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#0F172A] flex items-center justify-center p-6 text-white select-none">
          <div className="max-w-xl w-full bg-[#1E293B] border border-slate-700/80 rounded-2xl shadow-2xl p-8 flex flex-col items-center text-center">
            {/* Brand Header Icon */}
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-5 text-amber-500">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h1 className="text-xl font-bold tracking-wide text-white mb-2">
              Application Interface Recovery
            </h1>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed max-w-md">
              An unexpected interface rendering exception occurred. Your local database records, invoices, and job cards remain completely intact and safe.
            </p>

            {/* Error Message Snippet */}
            <div className="w-full bg-[#0F172A] border border-slate-800 rounded-xl p-3.5 mb-6 text-left">
              <div className="text-[11px] font-mono text-amber-400 font-semibold mb-1 truncate">
                {this.state.error?.name || 'Exception'}: {this.state.error?.message || 'Unknown render exception'}
              </div>
              <div className="text-[10px] font-mono text-slate-500 max-h-24 overflow-y-auto scrollbar-thin">
                {this.state.error?.stack?.slice(0, 300)}...
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 w-full">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shadow-lg transition active:scale-95"
              >
                Reload Interface
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 transition"
              >
                Clear Cache &amp; Restart
              </button>
              <button
                type="button"
                onClick={this.copyDiagnostics}
                className="px-4 py-2.5 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-medium transition"
              >
                Copy Diagnostics
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
