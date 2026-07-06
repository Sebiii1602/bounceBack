import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-card p-4 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 text-xs font-medium uppercase tracking-wider text-faint">{children}</div>
  )
}

export function PageTitle({ overline, title }: { overline?: string; title: string }) {
  return (
    <header className="mb-4">
      {overline && <div className="text-sm text-soft">{overline}</div>}
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
    </header>
  )
}

export function Wordmark({ className = 'text-lg' }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight ${className}`}>
      bounce<span className="text-track">Back</span>
    </span>
  )
}
