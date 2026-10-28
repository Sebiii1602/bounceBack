import { copy } from '../lib/copy'

const CX = 100
const CY = 100
const R = 80
const BOGEN = Math.PI * R

/** Punkt auf dem Halbkreis — 0 links, 100 rechts. */
function punkt(pct: number): { x: number; y: number } {
  const winkel = Math.PI * (1 - Math.min(100, Math.max(0, pct)) / 100)
  return { x: CX + R * Math.cos(winkel), y: CY - R * Math.sin(winkel) }
}

/**
 * Momentum als Halbkreis statt als Fortschrittsbalken.
 *
 * Ein Balken liest sich wie ein Ladebalken: 100 ist das Ziel, alles darunter
 * ist Rest. Momentum ist aber kein Ziel, sondern ein Pegel — der Bogen zeigt
 * eine Position auf einer Skala, nicht einen Weg, der noch fehlt.
 *
 * Der blasse Strich markiert den Stand von vor sieben Tagen: So sieht man die
 * Bewegung, nicht nur den Wert. Bewusst eine Farbe über die ganze Skala —
 * Ampelfarben würden einen niedrigen Stand zum Urteil machen.
 */
export function MomentumGauge({ value, change }: { value: number; change: number | null }) {
  const anteil = Math.min(100, Math.max(0, value)) / 100
  const kappe = punkt(value)
  const vorher = change === null ? null : punkt(value - change)

  return (
    <div className="relative mx-auto w-full max-w-[260px]">
      <svg viewBox="0 0 200 118" className="w-full" role="img" aria-label={`${copy.trend.momentum} ${value}`}>
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={13}
          strokeLinecap="round"
        />
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="var(--color-track)"
          strokeWidth={13}
          strokeLinecap="round"
          strokeDasharray={`${BOGEN * anteil} ${BOGEN}`}
        />
        {vorher && change !== 0 && (
          <line
            x1={CX + (R - 11) * ((vorher.x - CX) / R)}
            y1={CY + (R - 11) * ((vorher.y - CY) / R)}
            x2={CX + (R + 11) * ((vorher.x - CX) / R)}
            y2={CY + (R + 11) * ((vorher.y - CY) / R)}
            stroke="var(--color-faint)"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.5}
          />
        )}
        <circle cx={kappe.x} cy={kappe.y} r={4} fill="var(--color-card)" />
        <circle cx={kappe.x} cy={kappe.y} r={4} fill="var(--color-track)" opacity={0.9} />
        <text
          x={CX}
          y={CY - 14}
          textAnchor="middle"
          className="fill-ink"
          style={{ fontSize: 42, fontWeight: 600, letterSpacing: '-0.02em' }}
        >
          {value}
        </text>
      </svg>
    </div>
  )
}
