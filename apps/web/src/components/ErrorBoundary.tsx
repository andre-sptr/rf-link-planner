import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ACTIVE_DRAFT_STORAGE_KEY } from '../state/usePlannerStore';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Unexpected rendering error',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('LinkSight RF ErrorBoundary caught:', error, info.componentStack);
  }

  private handleResetDraftAndReload = () => {
    try {
      window.localStorage.removeItem(ACTIVE_DRAFT_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
    window.location.assign(window.location.pathname);
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        className="min-h-dvh flex items-center justify-center p-6"
        style={{
          backgroundColor: 'var(--bg-canvas)',
          color: 'var(--text-primary)',
        }}
      >
        <div
          className="max-w-md w-full rounded-xl border p-6 space-y-4 shadow-lg"
          style={{
            backgroundColor: 'var(--bg-panel)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <h1 className="text-base font-semibold">
            LinkSight RF encountered an unexpected error
          </h1>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {this.state.message}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={this.handleResetDraftAndReload}
              className="px-3 py-2 rounded-md text-xs font-semibold cursor-pointer"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-ink)',
              }}
            >
              Reset Draft &amp; Reload
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-3 py-2 rounded-md border text-xs font-medium cursor-pointer"
              style={{
                borderColor: 'var(--border-subtle)',
                backgroundColor: 'var(--bg-elevated)',
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
