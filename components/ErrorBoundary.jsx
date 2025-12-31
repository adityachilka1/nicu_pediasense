'use client';

import { Component } from 'react';

// Error Boundary for catching React errors
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // Log error to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to Sentry, DataDog, etc.
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          resetError={() => this.setState({ hasError: false, error: null, errorInfo: null })}
          title={this.props.title}
        />
      );
    }

    return this.props.children;
  }
}

// Default error fallback UI
export function ErrorFallback({ error, resetError, title = 'Something went wrong' }) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="min-h-[200px] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>

        <p className="text-slate-400 mb-4">
          {isDev && error?.message
            ? error.message
            : 'An unexpected error occurred. Please try again.'}
        </p>

        {isDev && error?.stack && (
          <pre className="text-left text-xs bg-slate-900 p-3 rounded-lg overflow-auto max-h-32 mb-4 text-red-400">
            {error.stack}
          </pre>
        )}

        <div className="flex gap-3 justify-center">
          {resetError && (
            <button
              onClick={resetError}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Try Again
            </button>
          )}
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}

// Inline error state for API failures
export function ErrorState({
  title = 'Failed to load data',
  message,
  onRetry,
  compact = false,
}) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-red-400 text-sm p-2 bg-red-500/10 rounded-lg">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{message || title}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-auto text-xs underline hover:no-underline"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h4 className="text-white font-medium mb-1">{title}</h4>
      {message && <p className="text-slate-400 text-sm mb-3">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

// Empty state component
export function EmptyState({
  icon,
  title = 'No data',
  message,
  action,
  actionLabel,
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center mb-3">
          {icon}
        </div>
      )}
      <h4 className="text-white font-medium mb-1">{title}</h4>
      {message && <p className="text-slate-400 text-sm mb-3">{message}</p>}
      {action && actionLabel && (
        <button
          onClick={action}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default ErrorBoundary;
