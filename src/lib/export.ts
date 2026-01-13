export function downloadDataURL(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export async function exportElementToPng(element: HTMLElement, filename: string) {
  const { default: html2canvas } = await import('html2canvas')
  const dpr = Math.max(1, window.devicePixelRatio || 1)
  const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
  const backgroundColor = prefersDark ? '#020617' : '#ffffff'

  const canvas = await html2canvas(element, {
    backgroundColor,
    scale: dpr,
    useCORS: true,
  })
  downloadDataURL(canvas.toDataURL('image/png'), filename)
}

export function exportRowsToCsv(rows: Array<Array<string | number>>, filename: string) {
  const csv = rows
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
