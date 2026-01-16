// Content script for Google Calendar

(function init() {
  const BUTTON_ID = 'subly-open-panel'
  const STATE_KEY = 'subly:state'

  function removeButton() {
    const el = document.getElementById(BUTTON_ID)
    if (el) el.remove()
  }

  function ensureButton() {
    if (document.getElementById(BUTTON_ID)) return

    const btn = document.createElement('button')
    btn.id = BUTTON_ID
    btn.type = 'button'
    btn.textContent = 'Subly'
    btn.title = 'Open Subly'
    btn.setAttribute('aria-label', 'Open Subly side panel')

    btn.style.position = 'fixed'
    btn.style.right = '12px'
    btn.style.bottom = '12px'
    btn.style.zIndex = '2147483647'
    btn.style.padding = '10px 12px'
    btn.style.borderRadius = '999px'
    btn.style.border = '1px solid rgba(0,0,0,0.18)'
    btn.style.background = 'white'
    btn.style.color = '#111827'
    btn.style.font = '600 12px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
    btn.style.boxShadow = '0 8px 18px rgba(0,0,0,0.14)'
    btn.style.cursor = 'pointer'

    btn.addEventListener('click', () => {
      try {
        chrome.runtime.sendMessage({ type: 'OPEN_PANEL' })
      } catch {
        // ignore
      }
    })

    const parent = document.body || document.documentElement
    parent.appendChild(btn)
  }

  async function isFloatingButtonEnabled() {
    try {
      if (!chrome?.storage?.local) return true
      const res = await chrome.storage.local.get([STATE_KEY])
      const s = res && res[STATE_KEY]
      const enabled = s && s.settings ? s.settings.calendarFloatingButtonEnabled : undefined
      return enabled !== false
    } catch {
      return true
    }
  }

  async function syncButton() {
    const enabled = await isFloatingButtonEnabled()
    if (!enabled) {
      removeButton()
      return
    }
    ensureButton()
  }

  // Initial render.
  void syncButton()

  // Live-update when the setting changes.
  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return
      if (!changes || !changes[STATE_KEY]) return
      void syncButton()
    })
  } catch {
    // ignore
  }
})()
