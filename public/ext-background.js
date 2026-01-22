// MV3 background service worker (module)

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
})

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'OPEN_PANEL') {
    const tabId = sender.tab?.id
    if (typeof tabId === 'number') {
      chrome.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: true })
      chrome.sidePanel.open({ tabId })
    }
    return
  }

  // Forward reload requests to any open Google Calendar tabs so they refresh immediately.
  if (message?.type === 'RELOAD_CALENDAR') {
    try {
      chrome.tabs.query({ url: '*://calendar.google.com/*' }, (tabs) => {
        if (!tabs || tabs.length === 0) return
        for (const t of tabs) {
          try {
            // Prefer telling the content script to reload itself. Use callback to
            // detect if the content script isn't present and fallback to reload.
            chrome.tabs.sendMessage(t.id, { type: 'RELOAD_CALENDAR' }, (resp) => {
              if (chrome.runtime.lastError) {
                try {
                  chrome.tabs.reload(t.id)
                } catch {}
              }
            })
          } catch {
            try {
              chrome.tabs.reload(t.id)
            } catch {}
          }
        }
      })
    } catch {}
    return
  }
})
