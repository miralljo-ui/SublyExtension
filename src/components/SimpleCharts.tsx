import { useMemo } from 'react'
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler)

type LineChartProps = {
  labels: string[]
  values: number[]
  height?: number
  formatValue?: (value: number) => string
  ariaLabel?: string
}

const tailwindColorCache = new Map<string, string>()

function resolveTailwindTextColor(className: string): string | null {
  if (tailwindColorCache.has(className)) return tailwindColorCache.get(className) ?? null
  if (typeof document === 'undefined') return null

  const el = document.createElement('span')
  el.className = `${className} pointer-events-none fixed -left-[9999px] -top-[9999px]`
  el.textContent = '.'
  document.body.appendChild(el)
  const color = getComputedStyle(el).color
  el.remove()

  tailwindColorCache.set(className, color)
  return color
}

function rgba(color: string | null, alpha: number) {
  if (!color) return `rgba(99, 102, 241, ${alpha})`
  const m = color.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\)/i)
  if (!m) return color
  const r = Number(m[1])
  const g = Number(m[2])
  const b = Number(m[3])
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function SimpleLineChart({ labels, values, height = 224, formatValue, ariaLabel = 'Line chart' }: LineChartProps) {
  const indigo = resolveTailwindTextColor('text-indigo-500')
  const gridBase = resolveTailwindTextColor('text-slate-200 dark:text-slate-700')
  const tick = resolveTailwindTextColor('text-slate-500 dark:text-slate-400')

  const data = useMemo(() => ({
    labels,
    datasets: [
      {
        label: ariaLabel,
        data: values,
        borderColor: indigo ?? 'rgb(99, 102, 241)',
        backgroundColor: rgba(indigo, 0.16),
        fill: true,
        tension: 0.35,
        pointRadius: (ctx: any) => (ctx.dataIndex === values.length - 1 ? 4 : 3),
        pointHoverRadius: 6,
        pointBackgroundColor: indigo ?? 'rgb(99, 102, 241)',
        pointBorderWidth: 0,
      },
    ],
  }), [ariaLabel, indigo, labels, values])

  const options = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = typeof ctx.parsed?.y === 'number' ? ctx.parsed.y : Number(ctx.raw)
            return formatValue ? formatValue(v) : String(v)
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: rgba(gridBase, 0.35) },
        ticks: { color: tick ?? undefined, maxTicksLimit: 6 },
      },
      y: {
        grid: { color: rgba(gridBase, 0.65) },
        ticks: {
          color: tick ?? undefined,
          maxTicksLimit: 6,
          callback: (value) => {
            const n = typeof value === 'number' ? value : Number(value)
            return formatValue ? formatValue(n) : String(value)
          },
        },
      },
    },
  }), [formatValue, gridBase, tick])

  return (
    <div className="w-full" style={{ height }}>
      <Line aria-label={ariaLabel} role="img" data={data} options={options} />
    </div>
  )
}

type BarItem = { label: string; value: number }

type BarChartProps = {
  items: BarItem[]
  formatValue?: (value: number) => string
}

export function SimpleBarChart({ items, formatValue }: BarChartProps) {
  const emerald = resolveTailwindTextColor('text-emerald-500')
  const gridBase = resolveTailwindTextColor('text-slate-200 dark:text-slate-700')
  const tick = resolveTailwindTextColor('text-slate-500 dark:text-slate-400')

  const height = Math.max(220, items.length * 34)

  const data = useMemo(() => ({
    labels: items.map(i => i.label),
    datasets: [
      {
        label: 'Value',
        data: items.map(i => i.value),
        borderRadius: 8,
        backgroundColor: rgba(emerald, 0.9),
      },
    ],
  }), [emerald, items])

  const options = useMemo<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = typeof ctx.parsed?.x === 'number' ? ctx.parsed.x : Number(ctx.raw)
            return formatValue ? formatValue(v) : String(v)
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: rgba(gridBase, 0.55) },
        ticks: {
          color: tick ?? undefined,
          callback: (value) => {
            const n = typeof value === 'number' ? value : Number(value)
            return formatValue ? formatValue(n) : String(value)
          },
        },
      },
      y: {
        grid: { display: false },
        ticks: { color: tick ?? undefined },
      },
    },
  }), [formatValue, gridBase, tick])

  return (
    <div className="w-full" style={{ height }}>
      <Bar role="img" data={data} options={options} />
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
  ariaLabel?: string
}

const PIE_COLORS = ['text-indigo-500', 'text-emerald-500', 'text-rose-500', 'text-amber-500', 'text-sky-500', 'text-violet-500']

export function SimplePieChart({ segments, formatValue, ariaLabel = 'Pie chart' }: PieChartProps) {
  const total = segments.reduce((sum, s) => sum + (Number.isFinite(s.value) ? s.value : 0), 0)
  if (total <= 0) {
    return <div className="text-sm text-slate-500">No hay datos para graficar.</div>
  }

  const shown = segments.filter(s => Number.isFinite(s.value) && s.value > 0)
  const colors = shown.map((s, i) => {
    const cls = s.className ?? PIE_COLORS[i % PIE_COLORS.length]
    return resolveTailwindTextColor(cls) ?? undefined
  })

  const tick = resolveTailwindTextColor('text-slate-500 dark:text-slate-400')

  const data = useMemo(() => ({
    labels: shown.map(s => s.label),
    datasets: [
      {
        data: shown.map(s => s.value),
        backgroundColor: colors.map(c => rgba(c ?? null, 0.9)),
        borderColor: colors.map(c => rgba(c ?? null, 1)),
        borderWidth: 0,
        hoverOffset: 6,
        cutout: '62%',
      },
    ],
  }), [colors, shown])

  const options = useMemo<ChartOptions<'doughnut'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = typeof ctx.parsed === 'number' ? ctx.parsed : Number(ctx.raw)
            const label = ctx.label ? `${ctx.label}: ` : ''
            return `${label}${formatValue ? formatValue(v) : String(v)}`
          },
        },
      },
    },
  }), [formatValue])

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
      <div className="h-56 w-56">
        <Doughnut aria-label={ariaLabel} role="img" data={data} options={options} />
      </div>

      <div className="w-full space-y-2">
        {shown.map((s, i) => {
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
                <div className="text-xs" style={{ color: tick ?? undefined }}>{pct}%</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
