import React from 'react'

type ErrorBoundaryProps = {
  children: React.ReactNode
  title?: string
  message?: string
  resetLabel?: string
  resetKey?: string
  onError?: (error: Error, info: React.ErrorInfo) => void
}

type ErrorBoundaryState = {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.props.onError?.(error, info)
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && this.props.resetKey && this.props.resetKey !== prevProps.resetKey) {
      this.setState({ hasError: false })
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const title = this.props.title ?? 'Something went wrong.'
    const message = this.props.message ?? 'Try reloading the panel or navigating to another section.'
    const resetLabel = this.props.resetLabel ?? 'Try again'

    return (
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 dark:text-white">
        <div className="text-base font-semibold">{title}</div>
        <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message}</div>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {resetLabel}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-100 dark:border-slate-800 dark:text-white dark:hover:bg-slate-900"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
