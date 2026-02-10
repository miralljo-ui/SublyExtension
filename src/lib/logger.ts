/**
 * Centralized logging for Subly Extension.
 * Provides structured logging with context and different severity levels.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  context?: string // Feature name or module
  error?: unknown // Original error object
  code?: string // Error code or status
  details?: Record<string, unknown> // Additional structured data
}

/**
 * Formats and logs messages with context.
 * In development, logs to console; in production, may route to analytics/crash reporting.
 */
function log(level: LogLevel, message: string, ctx?: LogContext) {
  const timestamp = new Date().toISOString().slice(11, 23) // HH:MM:SS.ms
  const contextStr = ctx?.context ? ` [${ctx.context}]` : ''
  const codeStr = ctx?.code ? ` (${ctx.code})` : ''
  const prefix = `${timestamp}${contextStr} ${level.toUpperCase()}${codeStr}:`

  if (typeof console !== 'undefined') {
    const consoleFn = (console as any)[level] || console.log

    if (ctx?.error) {
      consoleFn(`${prefix} ${message}`, ctx.error)
    } else {
      consoleFn(`${prefix} ${message}`)
    }

    if (ctx?.details && Object.keys(ctx.details).length > 0) {
      consoleFn(`  Details:`, ctx.details)
    }
  }

  // TODO: In production, send to analytics/crash reporting service
  // if (level === 'error') reportCrash(message, ctx)
}

export const logger = {
  /**
   * Debug level: detailed information, typically for development.
   */
  debug(message: string, ctx?: LogContext) {
    log('debug', message, ctx)
  },

  /**
   * Info level: general informational messages.
   */
  info(message: string, ctx?: LogContext) {
    log('info', message, ctx)
  },

  /**
   * Warn level: warning conditions that should be reviewed.
   */
  warn(message: string, ctx?: LogContext) {
    log('warn', message, ctx)
  },

  /**
   * Error level: error conditions requiring attention.
   */
  error(message: string, ctx?: LogContext) {
    log('error', message, ctx)
  },

  /**
   * Utility: Extract error message from unknown error object.
   */
  getErrorMessage(e: unknown): string {
    if (e instanceof Error) return e.message
    if (typeof e === 'string') return e
    return String(e)
  },

  /**
   * Utility: Check if error has HTTP status code.
   */
  getErrorStatus(e: unknown): number | undefined {
    if (e && typeof e === 'object' && 'status' in e && typeof (e as any).status === 'number') {
      return (e as any).status
    }
    return undefined
  },

  /**
   * Convenience: Log an error with status code if available.
   */
  logApiError(message: string, error: unknown, context?: string) {
    const status = this.getErrorStatus(error)
    const errorMsg = this.getErrorMessage(error)
    this.error(message, {
      context,
      code: status ? String(status) : undefined,
      error,
      details: { originalError: errorMsg },
    })
  },
}

export default logger
