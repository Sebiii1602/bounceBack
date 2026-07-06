import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { copy } from '../lib/copy'

function TabIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

const tabs = [
  {
    to: '/',
    label: copy.tabs.today,
    icon: (
      <TabIcon>
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.3 2.3 2.3 4.7-5" />
      </TabIcon>
    ),
  },
  {
    to: '/trend',
    label: copy.tabs.trend,
    icon: (
      <TabIcon>
        <path d="M3.5 17.5 9 12l4 4 7.5-8" />
        <path d="M15.5 8H21v5.5" />
      </TabIcon>
    ),
  },
  {
    to: '/verlauf',
    label: copy.tabs.history,
    icon: (
      <TabIcon>
        <rect x="4" y="5.5" width="16" height="15" rx="2.5" />
        <path d="M4 10.5h16M8.5 3.5v3M15.5 3.5v3" />
      </TabIcon>
    ),
  },
  {
    to: '/mehr',
    label: copy.tabs.more,
    icon: (
      <TabIcon>
        <circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      </TabIcon>
    ),
  },
]

export function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur">
      <div
        className="mx-auto grid max-w-md grid-cols-4"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                isActive ? 'text-track-deep' : 'text-faint'
              }`
            }
          >
            {tab.icon}
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
