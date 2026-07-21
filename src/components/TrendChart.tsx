import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fmtDayShort, fmtTick } from '../lib/dates'
import type { TrendPoint } from '../lib/metrics'

export function TrendChart({ data }: { data: TrendPoint[] }) {
  // In den ersten Tagen ist die Linie kaum sichtbar — Punkte helfen, bis genug Daten da sind
  const loggedPoints = data.filter((p) => p.pct !== null).length
  const dot = loggedPoints <= 10 ? { r: 3, strokeWidth: 0, fill: 'var(--color-track)' } : false
  return (
    <ResponsiveContainer width="100%" height={210}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--color-line)" strokeOpacity={0.6} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtTick}
          tick={{ fontSize: 11, fill: 'var(--color-faint)' }}
          tickLine={false}
          axisLine={false}
          minTickGap={40}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 50, 100]}
          tick={{ fontSize: 11, fill: 'var(--color-faint)' }}
          tickLine={false}
          axisLine={false}
          width={30}
        />
        <Tooltip
          formatter={(value) => [`${String(value)} %`, 'on track']}
          labelFormatter={(label) => fmtDayShort(String(label))}
          contentStyle={{
            borderRadius: 12,
            border: '1px solid var(--color-line)',
            backgroundColor: 'var(--color-card)',
            color: 'var(--color-ink)',
            fontSize: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        />
        <Line
          type="monotone"
          dataKey="pct"
          stroke="var(--color-track)"
          strokeWidth={2}
          dot={dot}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
