export type AuthTokenOptions = {
  interactive: boolean
  errorMessage?: (err: chrome.runtime.LastError | undefined) => string
}

export function isExtension(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.identity
}

export function getAuthToken(options: AuthTokenOptions | boolean): Promise<string> {
  const opts = typeof options === 'boolean' ? { interactive: options } : options

  if (!isExtension()) {
    return Promise.reject(new Error('Chrome identity API not available.'))
  }

  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: opts.interactive }, (token) => {
      const err = chrome.runtime.lastError
      if (err) {
        const msg = opts.errorMessage ? opts.errorMessage(err) : (err.message || 'OAuth token error')
        reject(new Error(msg))
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
