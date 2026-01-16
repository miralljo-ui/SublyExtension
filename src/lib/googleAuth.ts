function isExtension() {
  return typeof chrome !== 'undefined' && !!chrome.identity
}

function getAuthToken(interactive: boolean): Promise<string> {
  if (!isExtension()) throw new Error('Google auth requires Chrome Extension environment.')

  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      const err = chrome.runtime.lastError
      if (err) {
        reject(new Error(err.message || 'OAuth token error'))
        return
      }
      if (!token) {
        reject(new Error('No OAuth token received'))
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
  await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  }).catch(() => {
    // ignore
  })
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
