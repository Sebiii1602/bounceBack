import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fmtDayShort, fmtTick } from '../lib/dates'
import type { MomentumPoint } from '../lib/metrics'
import { copy } from '../lib/copy'

/** Momentum als Fläche — zeigt, wie sich der Puffer auf- und abbaut. */
export function MomentumChart({ data }: { data: MomentumPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="momentumFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-track)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--color-track)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
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
          formatter={(value) => [String(value), copy.trend.momentum]}
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
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--color-track)"
          strokeWidth={2}
          fill="url(#momentumFill)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
