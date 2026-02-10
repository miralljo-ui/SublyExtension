import { logger } from './logger'

function isExtension() {
  return typeof chrome !== 'undefined' && !!chrome.identity
}

/**
 * Extract meaningful error message from OAuth error.
 * Maps common Chrome identity API errors to user-friendly messages.
 */
function getOAuthErrorMessage(err: chrome.runtime.LastError | undefined): string {
  if (!err) return 'Unknown OAuth error'

  const msg = err.message || ''

  // Common OAuth error patterns and their meanings
  if (msg.includes('bad client id')) {
    return 'Invalid OAuth Client ID. Check OAUTH_SETUP.md for configuration help.'
  }
  if (msg.includes('invalid client') || msg.includes('client not found')) {
    return 'OAuth Client ID not found or invalid in Google Cloud Console.'
  }
  if (msg.includes('redirect_uri_mismatch')) {
    return 'Extension ID mismatch. Reload the extension and verify settings.'
  }
  if (msg.includes('access_denied')) {
    return 'Google OAuth access denied. Check your consent screen configuration.'
  }
  if (msg.includes('invalid scope')) {
    return 'OAuth scope not authorized. Verify Google API scopes are enabled.'
  }
  if (msg.includes('token expired')) {
    return 'OAuth token expired. Disconnect and reconnect in Settings.'
  }

  return `${msg || 'OAuth error'}. See OAUTH_SETUP.md for help.`
}

function getAuthToken(interactive: boolean): Promise<string> {
  if (!isExtension()) throw new Error('Google auth requires Chrome Extension environment.')

  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      const err = chrome.runtime.lastError
      if (err) {
        const friendlyMsg = getOAuthErrorMessage(err)
        logger.error('OAuth token request failed', {
          context: 'getAuthToken',
          error: err,
          details: { originalError: err.message },
        })
        reject(new Error(friendlyMsg))
        return
      }
      if (!token) {
        const msg = 'No OAuth token received. Try disconnecting and reconnecting in Settings.'
        logger.error(msg, { context: 'getAuthToken' })
        reject(new Error(msg))
        return
      }
      resolve(token)
    })
  })
}

async function removeCachedToken(token: string): Promise<void> {
  if (!isExtension()) return
  await new Promise<void>((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve())
  })
}

async function revokeToken(token: string): Promise<void> {
  // Best-effort; Google may return 200 even if already revoked.
  const body = new URLSearchParams({ token })
  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
  } catch (e) {
    logger.debug('Token revocation failed (expected if already revoked)', {
      context: 'revokeToken',
      error: e,
    })
  }
}

export async function disconnectGoogle(args?: { interactive?: boolean }): Promise<{ hadToken: boolean }> {
  const interactive = args?.interactive ?? false

  let token: string | undefined
  try {
    token = await getAuthToken(interactive)
  } catch {
    return { hadToken: false }
  }

  // Revoke remotely (best-effort), then clear local cache.
  await revokeToken(token)
  await removeCachedToken(token)
  return { hadToken: true }
}
