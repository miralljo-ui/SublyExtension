// Content script for Google Calendar

(function init() {
  const BUTTON_ID = 'subly-open-panel'

  function ensureButton() {
    if (document.getElementById(BUTTON_ID)) return

    const btn = document.createElement('button')
    btn.id = BUTTON_ID
    btn.type = 'button'
    btn.textContent = 'Subly'

    btn.style.position = 'fixed'
    btn.style.right = '12px'
    btn.style.bottom = '12px'
    btn.style.zIndex = '999999'
    btn.style.padding = '10px 12px'
    btn.style.borderRadius = '999px'
    btn.style.border = '1px solid rgba(0,0,0,0.15)'
    btn.style.background = 'white'
    btn.style.color = '#111827'
    btn.style.font = '600 12px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
    btn.style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)'
    btn.style.cursor = 'pointer'

    btn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_PANEL' })
    })

    document.documentElement.appendChild(btn)
  }

  ensureButton()
  setInterval(ensureButton, 1500)
})()
