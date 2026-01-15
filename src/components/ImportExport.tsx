import { useMemo, useState } from 'react'
import type { Subscription } from '../lib/types'
import { MAJOR_CURRENCIES } from '../lib/types'
import { createId } from '../lib/storage'
import { useI18n } from '../lib/i18n'
import { useToast } from './Toast'

type ImportExportProps = {
  items: Subscription[]
  onImport: (items: Subscription[]) => void
}

type ImportStatus = { type: 'success' | 'error'; message: string } | null

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function isValidPeriod(v: unknown): v is Subscription['period'] {
  return v === 'monthly' || v === 'quarterly' || v === 'semiannual' || v === 'annual'
}

function isValidYmd(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

function normalizeCurrency(code: unknown): string {
  const raw = typeof code === 'string' ? code.trim().toUpperCase() : ''
  if (!raw) return 'USD'
  const allowed = MAJOR_CURRENCIES.some(c => c.code === raw)
  return allowed ? raw : 'USD'
}

function normalizeImportedSubscription(input: any): Subscription | null {
  const name = typeof input?.name === 'string' ? input.name.trim() : ''
  if (!name) return null

  const priceNum = Number(input?.price)
  if (!Number.isFinite(priceNum)) return null

  const period = input?.period
  if (!isValidPeriod(period)) return null

  const startDate = input?.startDate
  if (!isValidYmd(startDate)) return null

  const currency = normalizeCurrency(input?.currency)
  const category = typeof input?.category === 'string' ? input.category.trim() : ''

  const id = typeof input?.id === 'string' && input.id.trim() ? input.id.trim() : createId()

  return {
    id,
    name,
    category: category ? category : undefined,
    price: priceNum,
    currency,
    period,
    startDate,
  }
}

export function ImportExport({ items, onImport }: ImportExportProps) {
  const { t } = useI18n()
  const [status, setStatus] = useState<ImportStatus>(null)
  const toast = useToast()

  const exportFilename = useMemo(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `subly-subscriptions-${y}${m}${day}.json`
  }, [])

  function handleExport() {
    downloadJson(exportFilename, items)
    toast.success(t('common.exported') ?? 'Exportado.')
  }

  function handleImportFile(file: File) {
    setStatus(null)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? 'null'))
        if (!Array.isArray(parsed)) throw new Error('Invalid structure')

        const normalized: Subscription[] = []
        for (const raw of parsed) {
          const next = normalizeImportedSubscription(raw)
          if (next) normalized.push(next)
        }

        if (normalized.length === 0) throw new Error('No valid items')

        // Merge by id: imported overwrites existing id; new ids are appended.
        const byId = new Map<string, Subscription>()
        for (const existing of items) byId.set(existing.id, existing)
        for (const incoming of normalized) byId.set(incoming.id, incoming)

        onImport(Array.from(byId.values()))
        setStatus({ type: 'success', message: t('common.importedCount', { count: normalized.length }) ?? `Importadas: ${normalized.length}` })
      } catch {
        setStatus({ type: 'error', message: t('common.importFailed') ?? 'Importación fallida (JSON inválido o estructura incorrecta).' })
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleExport}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        {t('common.exportJson') ?? 'Exportar JSON'}
      </button>

      <label className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
        {t('common.importJson') ?? 'Importar JSON'}
        <input
          type="file"
          accept="application/json"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            handleImportFile(f)
          }}
        />
      </label>

      {status ? (
        <div className={status.type === 'error' ? 'text-sm text-rose-600 dark:text-rose-300' : 'text-sm text-emerald-700 dark:text-emerald-300'}>
          {status.message}
        </div>
      ) : null}
    </div>
  )
}
