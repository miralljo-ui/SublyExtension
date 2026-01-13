import type React from 'react'

type LineChartProps = {
  labels: string[]
  values: number[]
  height?: number
  formatValue?: (value: number) => string
  ariaLabel?: string
}

export function SimpleLineChart({ labels, values, height = 160, formatValue, ariaLabel = 'Line chart' }: LineChartProps) {
  const width = 640
  const padding = 28
  const w = width - padding * 2
  const h = height - padding * 2

  const max = Math.max(1, ...values.filter(v => Number.isFinite(v)))
  const min = Math.min(0, ...values.filter(v => Number.isFinite(v)))
  const range = Math.max(1e-9, max - min)

  const yAt = (v: number) => padding + (1 - (v - min) / range) * h

  const pts = values.map((v, i) => {
    const x = padding + (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * w)
    const y = yAt(v)
    return { x, y, v }
  })

  const d = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ')

  const areaD = `${d} L ${(width - padding).toFixed(2)} ${(height - padding).toFixed(2)} L ${padding.toFixed(2)} ${(height - padding).toFixed(2)} Z`

  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const t = i / 4
    const v = max - t * range
    return { v, y: yAt(v) }
  })

  const xTickIdxs = labels.length <= 2 ? labels.map((_, i) => i) : [0, Math.floor((labels.length - 1) / 2), labels.length - 1]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label={ariaLabel}>
      <rect x={0} y={0} width={width} height={height} className="fill-transparent" />
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={padding} y1={t.y} x2={width - padding} y2={t.y} className="stroke-slate-200/70 dark:stroke-slate-700/70" strokeWidth={1} />
          <text x={padding - 6} y={t.y + 4} textAnchor="end" className="fill-slate-500 dark:fill-slate-400" fontSize="10">
            {formatValue ? formatValue(t.v) : t.v.toFixed(0)}
          </text>
        </g>
      ))}

      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="stroke-slate-300 dark:stroke-slate-700" strokeWidth={1} />

      {xTickIdxs.map(i => (
        <text
          key={i}
          x={padding + (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * w)}
          y={height - 8}
          textAnchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}
          className="fill-slate-500 dark:fill-slate-400"
          fontSize="10"
        >
          {labels[i]}
        </text>
      ))}

      <path d={areaD} className="fill-indigo-500/10" />
      <path d={d} className="stroke-indigo-500" strokeWidth={2.5} fill="none" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} className="fill-indigo-500" />
      ))}
    </svg>
  )
}

type BarItem = { label: string; value: number }

type BarChartProps = {
  items: BarItem[]
  formatValue?: (value: number) => string
}

export function SimpleBarChart({ items, formatValue }: BarChartProps) {
  const max = Math.max(1, ...items.map(i => i.value))

  return (
    <div className="space-y-2">
      {items.map(item => {
        const pct = Math.max(0, Math.min(100, (item.value / max) * 100))
        return (
          <div key={item.label} className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{item.label}</div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="text-right text-sm font-semibold text-slate-700 dark:text-slate-200">{formatValue ? formatValue(item.value) : item.value.toFixed(2)}</div>
          </div>
        )
      })}
    </div>
  )
}

type PieSegment = {
  label: string
  value: number
  className?: string
}

type PieChartProps = {
  segments: PieSegment[]
  formatValue?: (value: number) => string
}

const PIE_COLORS = ['text-indigo-500', 'text-emerald-500', 'text-rose-500', 'text-amber-500', 'text-sky-500', 'text-violet-500']

export function SimplePieChart({ segments, formatValue }: PieChartProps) {
  const total = segments.reduce((sum, s) => sum + (Number.isFinite(s.value) ? s.value : 0), 0)
  if (total <= 0) {
    return <div className="text-sm text-slate-500">No hay datos para graficar.</div>
  }

  // Circle geometry in a 36x36 viewBox
  const r = 16
  const c = 2 * Math.PI * r
  let offset = 0

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
      <svg viewBox="0 0 36 36" className="h-40 w-40" role="img" aria-label="Pie chart">
        <circle cx="18" cy="18" r={r} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="4" fill="none" />
        {segments
          .filter(s => s.value > 0)
          .map((s, i) => {
            const frac = s.value / total
            const dash = frac * c
            const dashArray = `${dash} ${c - dash}`
            const dashOffset = -offset
            offset += dash
            const cls = s.className ?? PIE_COLORS[i % PIE_COLORS.length]
            return (
              <circle
                key={`${s.label}-${i}`}
                cx="18"
                cy="18"
                r={r}
                stroke="currentColor"
                className={cls}
                strokeWidth="4"
                fill="none"
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 18 18)"
                strokeLinecap="butt"
              />
            )
          })}
      </svg>

      <div className="w-full space-y-2">
        {segments
          .filter(s => s.value > 0)
          .map((s, i) => {
            const pct = Math.round((s.value / total) * 100)
            const cls = s.className ?? PIE_COLORS[i % PIE_COLORS.length]
            return (
              <div key={`${s.label}-legend`} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`h-2 w-2 flex-none rounded-full ${cls} bg-current`} />
                  <span className="truncate font-semibold">{s.label}</span>
                </div>
                <div className="flex-none text-right text-slate-700 dark:text-slate-200">
                  <div className="text-sm font-semibold">{formatValue ? formatValue(s.value) : s.value.toFixed(2)}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{pct}%</div>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
