import { logger } from './logger'

export type TranslateFn = (key: string, params?: Record<string, string | number>) => string | undefined

function hasAny(haystack: string, needles: string[]) {
  return needles.some(needle => haystack.includes(needle))
}

export function formatUserError(t: TranslateFn, error: unknown, fallback: string): string {
  const raw = logger.getErrorMessage(error)
  const msg = raw.toLowerCase()

  if (hasAny(msg, ['oauth', 'client id', 'authorization', 'auth', 'token', 'redirect_uri_mismatch', 'invalid_scope'])) {
    return `${t('errors.oauth') ?? 'Error de autenticacion de Google.'} ${t('errors.oauthHint') ?? 'Revisa Ajustes -> Configuracion de Google.'}`
  }

  if (hasAny(msg, ['network', 'failed to fetch', 'fetch', 'offline', 'econn', 'enet', 'timeout'])) {
    return `${t('errors.network') ?? 'No hay conexion o la red fallo.'} ${t('errors.networkHint') ?? 'Comprueba tu conexion y vuelve a intentarlo.'}`
  }

  if (hasAny(msg, ['quota', 'rate limit', '429', 'too many requests'])) {
    return `${t('errors.rateLimit') ?? 'Limite de solicitudes alcanzado.'} ${t('errors.rateLimitHint') ?? 'Espera un momento e intentalo de nuevo.'}`
  }

  return raw ? `${fallback} ${raw}` : fallback
}
