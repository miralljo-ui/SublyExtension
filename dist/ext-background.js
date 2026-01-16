// MV3 background service worker (module)

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
})

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== 'OPEN_PANEL') return
  const tabId = sender.tab?.id
  if (typeof tabId !== 'number') return

  chrome.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: true })
  chrome.sidePanel.open({ tabId })
})
