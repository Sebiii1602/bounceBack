import { useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addHabit, addTag, db, deleteTag, renameHabit, renameTag, setHabitLogMode } from '../lib/db'
import { copy } from '../lib/copy'
import { APP_VERSION } from '../lib/config'
import { fmtTime } from '../lib/dates'
import { deleteHabitEverywhere, syncNow, useSyncStatus } from '../lib/sync'
import { useAuth } from '../lib/auth'
import { Card, SectionLabel, PageTitle } from '../components/ui'
import { LogModeChips } from '../components/LogModeChips'

function IconButton({ onClick, label, children }: { onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rounded-md p-1.5 text-faint transition hover:bg-paper hover:text-ink"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  )
}

const PencilIcon = (
  <>
    <path d="M4 20h4L19.5 8.5a2.12 2.12 0 0 0-3-3L5 17l-1 4Z" />
    <path d="m13.5 6.5 3 3" />
  </>
)

const TrashIcon = (
  <>
    <path d="M4 7h16" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="m6.5 7 .9 12.1a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9L17.5 7" />
  </>
)

interface NamedItem {
  id: string
  label: string
}

function NameList({
  items,
  addPlaceholder,
  onAdd,
  onRename,
  onDelete,
  confirmMsg,
  renderMeta,
  addExtra,
}: {
  items: NamedItem[]
  addPlaceholder: string
  onAdd: (label: string) => Promise<unknown>
  onRename: (id: string, label: string) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
  confirmMsg: (label: string) => string
  /** Optionaler Zusatz pro Zeile (z. B. Eintrag-Modus-Chip bei Habits) */
  renderMeta?: (item: NamedItem) => ReactNode
  /** Optionaler Zusatz unter dem Hinzufügen-Formular */
  addExtra?: ReactNode
}) {
  const [draft, setDraft] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')

  return (
    <div>
      <div className="divide-y divide-line/70">
        {items.map((item) =>
          editId === item.id ? (
            <form
              key={item.id}
              className="flex gap-2 py-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (editVal.trim() !== '') void onRename(item.id, editVal)
                setEditId(null)
              }}
            >
              <input
                autoFocus
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-track"
              />
              <button type="submit" className="shrink-0 rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-card">
                {copy.common.save}
              </button>
            </form>
          ) : (
            <div key={item.id} className="flex items-center justify-between py-1.5">
              <span className="text-sm">{item.label}</span>
              <div className="flex items-center gap-0.5">
                {renderMeta?.(item)}
                <IconButton
                  label={copy.common.rename}
                  onClick={() => {
                    setEditId(item.id)
                    setEditVal(item.label)
                  }}
                >
                  {PencilIcon}
                </IconButton>
                <IconButton
                  label={copy.common.delete}
                  onClick={() => {
                    if (window.confirm(confirmMsg(item.label))) void onDelete(item.id)
                  }}
                >
                  {TrashIcon}
                </IconButton>
              </div>
            </div>
          ),
        )}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (draft.trim() === '') return
          void onAdd(draft)
          setDraft('')
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={addPlaceholder}
          className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-track"
        />
        <button type="submit" className="shrink-0 rounded-lg bg-track px-3 py-1.5 text-sm font-medium text-white">
          {copy.common.add}
        </button>
      </form>
      {addExtra && <div className="mt-2">{addExtra}</div>}
    </div>
  )
}

function SyncCard() {
  const status = useSyncStatus()
  const { cloud } = useAuth()

  if (!cloud) {
    return (
      <Card className="mt-3">
        <SectionLabel>{copy.more.sync}</SectionLabel>
        <p className="text-sm text-soft">{copy.more.syncLocal}</p>
      </Card>
    )
  }

  const dot =
    status.state === 'synced'
      ? 'bg-track'
      : status.state === 'syncing'
        ? 'animate-pulse bg-track'
        : status.state === 'error'
          ? 'bg-slip'
          : 'bg-faint'
  const label =
    status.state === 'synced'
      ? copy.more.syncSynced
      : status.state === 'syncing'
        ? copy.more.syncSyncing
        : status.state === 'error'
          ? copy.more.syncError
          : copy.more.syncOffline

  return (
    <Card className="mt-3">
      <SectionLabel>{copy.more.sync}</SectionLabel>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          <span>{label}</span>
        </div>
        <button
          type="button"
          onClick={() => void syncNow()}
          className="rounded-lg border border-line px-3 py-1.5 text-sm text-soft transition hover:text-ink"
        >
          {copy.more.syncNow}
        </button>
      </div>
      {status.lastSyncAt && (
        <p className="mt-2 text-xs text-faint">{copy.more.lastSync(fmtTime(status.lastSyncAt))}</p>
      )}
    </Card>
  )
}

export function More() {
  const habits = useLiveQuery(
    async () => (await db.habits.toArray()).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [],
  )
  const tags = useLiveQuery(
    async () => (await db.tags.toArray()).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [],
  )
  const { cloud, session, signOut } = useAuth()
  const [newSameDay, setNewSameDay] = useState(false)

  async function removeHabit(id: string) {
    try {
      await deleteHabitEverywhere(id)
    } catch {
      window.alert(copy.more.habitDeleteOnlineOnly)
    }
  }

  return (
    <div>
      <PageTitle title={copy.tabs.more} />
      <Card>
        <SectionLabel>{copy.more.habits}</SectionLabel>
        <NameList
          items={(habits ?? []).map((h) => ({ id: h.id, label: h.name }))}
          addPlaceholder={copy.more.addHabit}
          onAdd={(name) => addHabit(name, newSameDay)}
          onRename={renameHabit}
          onDelete={removeHabit}
          confirmMsg={copy.more.deleteHabitConfirm}
          renderMeta={(item) => {
            const habit = habits?.find((h) => h.id === item.id)
            if (!habit) return null
            return (
              <button
                type="button"
                onClick={() => void setHabitLogMode(habit.id, !habit.log_same_day)}
                title={copy.today.modeHint}
                className="mr-1 rounded-full border border-line px-2 py-0.5 text-[11px] text-soft transition hover:text-ink"
              >
                {habit.log_same_day ? copy.more.logModeSame : copy.more.logModeNext}
              </button>
            )
          }}
          addExtra={<LogModeChips value={newSameDay} onChange={setNewSameDay} />}
        />
      </Card>
      <Card className="mt-3">
        <SectionLabel>{copy.more.tags}</SectionLabel>
        <NameList
          items={(tags ?? []).map((t) => ({ id: t.id, label: t.label }))}
          addPlaceholder={copy.more.addTag}
          onAdd={addTag}
          onRename={renameTag}
          onDelete={deleteTag}
          confirmMsg={copy.more.deleteTagConfirm}
        />
      </Card>
      <SyncCard />
      {cloud && session && (
        <Card className="mt-3">
          <SectionLabel>{copy.more.account}</SectionLabel>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm text-soft">{session.user.email}</span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm text-soft transition hover:text-ink"
            >
              {copy.more.signOut}
            </button>
          </div>
        </Card>
      )}
      <Card className="mt-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-soft">{copy.more.exportCsv}</span>
          <span className="rounded-full border border-line px-2 py-0.5 text-xs text-faint">
            {copy.more.exportSoon}
          </span>
        </div>
      </Card>
      <p className="mt-6 text-center text-xs text-faint">
        {copy.appName} · v{APP_VERSION}
      </p>
    </div>
  )
}
