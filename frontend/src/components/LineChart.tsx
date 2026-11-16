import { useEffect, useRef, useState } from 'react'
import { fmt, type Series } from '@/data/health'

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** Pairs of strictly consecutive slots that both have data.
 * Empty days remain as gaps without connecting lines.
 */
function segments(s: Series): [number, number][] {
  const idx = s.data.flatMap((d, i) => (d.v == null ? [] : [i]))
  return idx.slice(1).flatMap((b, k) => {
    const a = idx[k]
    return b - a === 1 ? [[a, b] as [number, number]] : []
  })
}

function ticks(min: number, max: number, count = 4) {
  const span = max - min || 1
  const raw = span / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const out: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(4))
  return out
}

export function LineChart({
  series,
  unit,
  yTitle,
  decimals,
  band,
  bands,
  bandLabels,
  yRange,
  height = 200,
  label,
}: {
  series: Series[]
  unit: string
  yTitle: string
  decimals: number
  band?: [number, number]
  bands?: [number, number][]
  bandLabels?: string[]
  yRange?: [number, number]
  height?: number
  label: string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const n = series[0]?.data.length ?? 0
  const pad = { l: 40, r: 12, t: 26, b: 26 }
  const iw = Math.max(0, width - pad.l - pad.r)
  const ih = height - pad.t - pad.b

  // Slots without a Sổ tay entry (v === null) get no point; the cursor only stops on slots with data.
  const has = (i: number) => series.some((s) => s.data[i]?.v != null)
  const withData = Array.from({ length: n }, (_, i) => i).filter(has)
  const nearest = (i: number) => withData.reduce((b, k) => (Math.abs(k - i) < Math.abs(b - i) ? k : b), withData[0] ?? 0)
  const step = (from: number | null, dir: 1 | -1) => {
    if (from === null) return dir === 1 ? withData[0] : withData[withData.length - 1]
    const next = dir === 1 ? withData.find((k) => k > from) : [...withData].reverse().find((k) => k < from)
    return next ?? from
  }

  const activeBands: [number, number][] = bands ?? (band ? [band] : [])
  const allData = series.flatMap((s) => s.data.flatMap((d) => (d.v == null ? [] : [d.v])))
  const allPoints = allData.concat(activeBands.flat()).concat(yRange ?? [])
  const rawMin = allPoints.length ? Math.min(...allPoints) : 0
  const rawMax = allPoints.length ? Math.max(...allPoints) : 100
  const spread = rawMax - rawMin || Math.max(1, rawMax * 0.1)
  const yt = ticks(rawMin - spread * 0.08, rawMax + spread * 0.08)
  const y0 = yt[0]
  const y1 = yt[yt.length - 1]
  const x = (i: number) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (v: number) => pad.t + ih - ((v - y0) / (y1 - y0)) * ih

  const onMove = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect()
    const px = clientX - rect.left - pad.l
    const i = n <= 1 ? 0 : Math.round((px / iw) * (n - 1))
    setActive(nearest(Math.max(0, Math.min(n - 1, i))))
  }

  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-hidden select-none" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={label}
          tabIndex={0}
          className="absolute inset-0 block rounded-md outline-offset-[-2px]"
          onMouseMove={(e) => onMove(e.clientX)}
          onMouseLeave={() => setActive(null)}
          onTouchStart={(e) => onMove(e.touches[0].clientX)}
          onTouchMove={(e) => onMove(e.touches[0].clientX)}
          onFocus={() => setActive((a) => a ?? withData[withData.length - 1] ?? null)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') setActive((a) => step(a, 1))
            if (e.key === 'ArrowLeft') setActive((a) => step(a, -1))
          }}
        >
          <text x={0} y={12} className="fill-ink-600 text-xs font-medium">
            {yTitle}
          </text>
          {activeBands.map((b, idx) => (
            <g key={idx}>
              <rect x={pad.l} width={iw} y={y(b[1])} height={Math.max(0, y(b[0]) - y(b[1]))} fill="var(--color-gray-bg)" />
              <text x={pad.l + iw - 4} y={y(b[1]) + 13} textAnchor="end" className="fill-ink-600 text-xs font-medium">
                {bandLabels?.[idx] ?? 'Khoảng tham khảo'}
              </text>
            </g>
          ))}
          {yt.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={pad.l + iw} y1={y(t)} y2={y(t)} stroke="var(--color-line-200)" />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="fill-ink-600 font-mono text-xs">
                {fmt(t, decimals && t % 1 ? 1 : 0)}
              </text>
            </g>
          ))}
          {series[0]?.data.map((d, i) => (
            <text key={i} x={x(i)} y={height - 6} textAnchor="middle" className={`text-xs ${active === i ? 'fill-ink-900 font-semibold' : 'fill-ink-600'}`}>
              {n > 7 && i % 2 === 1 && width < 420 ? '' : d.t}
            </text>
          ))}
          {active !== null && <line x1={x(active)} x2={x(active)} y1={pad.t} y2={pad.t + ih} stroke="var(--color-ink-400)" strokeDasharray="3 3" />}
          {series.map((s) => (
            <g key={s.name}>
              {segments(s).map(([a, b]) => (
                <line
                  key={`${a}-${b}`}
                  x1={x(a)}
                  y1={y(s.data[a].v!)}
                  x2={x(b)}
                  y2={y(s.data[b].v!)}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray={s.dashed ? '4 4' : undefined}
                />
              ))}
              {s.data.map((d, i) =>
                d.v == null ? null : <circle key={i} cx={x(i)} cy={y(d.v)} r={active === i ? 5 : 3.5} fill="var(--color-surface)" stroke={s.color} strokeWidth={2} />,
              )}
            </g>
          ))}
        </svg>
      )}
      {active !== null && series[0] && (
        <div
          className="pointer-events-none absolute top-6 z-10 min-w-[132px] rounded-lg border border-line-200 bg-surface px-3 py-2 shadow-e2"
          style={{
            left: Math.min(Math.max(x(active) - 66, 0), Math.max(0, width - 150)),
          }}
          role="status"
        >
          <p className="text-xs text-ink-600">{series[0].data[active].full}</p>
          {series.map((s) => s.data[active].v == null ? null : (
            <p key={s.name} className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-900">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
              {series.length > 1 && <span className="text-ink-600">{s.name}</span>}
              <span className="ml-auto font-mono font-medium">
                {fmt(s.data[active].v!, decimals)} {unit}
              </span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
