import { useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addHabit,
  addTag,
  db,
  deleteTag,
  renameHabit,
  renameTag,
  setHabitLogMode,
  setHabitPromptDeck,
  setHabitAlias,
  setHabitAudioNotes,
  setHabitTarget,
  sortHabits,
  sortTags,
  moveHabit,
} from '../lib/db'
import { copy } from '../lib/copy'
import { APP_BUILD } from '../lib/config'
import { fmtTime } from '../lib/dates'
import { deleteHabitEverywhere, syncNow, useSyncStatus } from '../lib/sync'
import { useAuth } from '../lib/auth'
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme'
import {
  disableReminder,
  enableReminder,
  getReminderHour,
  pushSupported,
  updateReminderHour,
} from '../lib/push'
import { Card, SectionLabel, PageTitle } from '../components/ui'
import { LogModeChips } from '../components/LogModeChips'
import { HabitSwitcher } from '../components/HabitSwitcher'
import { ALL_DECKS, DECK_LABEL } from '../lib/prompts'
import { displayName, useRevealed } from '../lib/privacy'
import type { Habit, PromptDeck } from '../lib/types'

const WEEK_TARGETS = [null, 1, 2, 3, 4, 5] as const

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${
        active ? 'border-ink bg-ink text-card' : 'border-line bg-card text-soft'
      }`}
    >
      {children}
    </button>
  )
}

/** Deckname mit Speichern-Knopf — leeres Feld hebt „privat" wieder auf. */
function AliasField({ habit }: { habit: Habit }) {
  const [draft, setDraft] = useState(habit.private_alias ?? '')
  useEffect(() => {
    setDraft(habit.private_alias ?? '')
  }, [habit.id, habit.private_alias])
  const geaendert = draft.trim() !== (habit.private_alias ?? '')
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        void setHabitAlias(habit.id, draft)
      }}
    >
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={copy.more.aliasPlaceholder}
        className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-base outline-none focus:border-track"
      />
      <button
        type="submit"
        disabled={!geaendert}
        className="shrink-0 rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-card disabled:opacity-40"
      >
        {copy.common.save}
      </button>
    </form>
  )
}

/**
 * Einstellungen pro Habit. Bewusst eine eigene Karte statt Chips in der Liste:
 * Eintrag-Modus, Wochenziel und Tagesimpuls passen nicht nebeneinander in eine
 * Zeile, und ein Wochenziel ändert die Bedeutung der anderen Optionen.
 */
function HabitOptions({ habits }: { habits: Habit[] }) {
  const [picked, setPicked] = useState<string | null>(null)
  const habit = habits.find((h) => h.id === picked) ?? habits[0]
  if (!habit) return null
  const isGoal = habit.target_per_week !== null

  return (
    <Card className="mt-3">
      <SectionLabel>{copy.more.habitSetup}</SectionLabel>
      {habits.length > 1 && (
        <HabitSwitcher habits={habits} value={habit.id} onChange={setPicked} />
      )}
      <p className="mb-2 text-xs text-faint">{copy.more.targetLabel}</p>
      <div className="flex flex-wrap gap-2">
        {WEEK_TARGETS.map((t) => (
          <Chip
            key={String(t)}
            active={habit.target_per_week === t}
            onClick={() => void setHabitTarget(habit.id, t)}
          >
            {t === null ? copy.more.targetDaily : `${t}×`}
          </Chip>
        ))}
      </div>
      <p className="mt-2 text-xs text-faint">
        {isGoal ? copy.more.targetHintGoal : copy.more.targetHintDaily}
      </p>

      {!isGoal && (
        <>
          <p className="mb-2 mt-4 text-xs text-faint">{copy.more.modeLabel}</p>
          <LogModeChips
            value={habit.log_same_day}
            onChange={(v) => void setHabitLogMode(habit.id, v)}
          />
          <p className="mt-2 text-xs text-faint">{copy.today.modeHint}</p>
        </>
      )}

      <p className="mb-2 mt-4 text-xs text-faint">{copy.more.aliasLabel}</p>
      <AliasField habit={habit} />
      <p className="mt-2 text-xs text-faint">{copy.more.aliasHint}</p>

      <p className="mb-2 mt-4 text-xs text-faint">{copy.more.promptLabel}</p>
      <div className="flex flex-wrap gap-2">
        <Chip
          active={habit.prompt_deck === null}
          onClick={() => void setHabitPromptDeck(habit.id, null)}
        >
          {copy.more.promptNone}
        </Chip>
        {ALL_DECKS.map((deck: PromptDeck) => (
          <Chip
            key={deck}
            active={habit.prompt_deck === deck}
            onClick={() => void setHabitPromptDeck(habit.id, deck)}
          >
            {DECK_LABEL[deck]}
          </Chip>
        ))}
      </div>
      <p className="mt-2 text-xs text-faint">{copy.more.promptHint}</p>

      <p className="mb-2 mt-4 text-xs text-faint">{copy.more.audioLabel}</p>
      <div className="flex flex-wrap gap-2">
        <Chip active={!habit.audio_notes} onClick={() => void setHabitAudioNotes(habit.id, false)}>
          {copy.more.audioOff}
        </Chip>
        <Chip active={habit.audio_notes} onClick={() => void setHabitAudioNotes(habit.id, true)}>
          {copy.more.audioOn}
        </Chip>
      </div>
      <p className="mt-2 text-xs text-faint">{copy.more.audioHint}</p>
    </Card>
  )
}

function AppearanceCard() {
  const [pref, setPref] = useState<ThemePref>(() => getThemePref())
  const options: Array<{ value: ThemePref; label: string }> = [
    { value: 'system', label: copy.more.themeSystem },
    { value: 'light', label: copy.more.themeLight },
    { value: 'dark', label: copy.more.themeDark },
  ]
  return (
    <Card className="mt-3">
      <SectionLabel>{copy.more.appearance}</SectionLabel>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              setThemePref(opt.value)
              setPref(opt.value)
            }}
            className={`flex-1 rounded-full border px-3 py-1.5 text-sm transition ${
              pref === opt.value ? 'border-ink bg-ink text-card' : 'border-line bg-card text-soft'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </Card>
  )
}

const REMINDER_HOURS = [7, 8, 9, 12, 18, 19, 20, 21, 22]

function ReminderCard() {
  const { cloud, session } = useAuth()
  const supported = pushSupported()
  const [hour, setHour] = useState(20)
  const [activeHour, setActiveHour] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supported || !cloud || !session) return
    void getReminderHour().then((h) => {
      if (h !== null) {
        setActiveHour(h)
        setHour(h)
      }
    })
  }, [supported, cloud, session])

  if (!cloud || !session) return null

  async function toggle() {
    setBusy(true)
    try {
      if (activeHour !== null) {
        await disableReminder()
        setActiveHour(null)
      } else {
        const result = await enableReminder(hour)
        if (result === 'denied') window.alert(copy.more.reminderDenied)
        else setActiveHour(hour)
      }
    } finally {
      setBusy(false)
    }
  }

  async function changeHour(next: number) {
    setHour(next)
    if (activeHour !== null) {
      await updateReminderHour(next)
      setActiveHour(next)
    }
  }

  return (
    <Card className="mt-3">
      <SectionLabel>{copy.more.reminder}</SectionLabel>
      {!supported ? (
        <p className="text-sm text-soft">{copy.more.reminderUnsupported}</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-soft">
              {copy.more.reminderTime}
              <select
                value={hour}
                onChange={(e) => void changeHour(Number(e.target.value))}
                className="rounded-lg border border-line bg-card px-2 py-1.5 text-ink outline-none"
              >
                {REMINDER_HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h}:00
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggle()}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                activeHour !== null
                  ? 'border border-line text-soft hover:text-ink'
                  : 'bg-track text-white'
              }`}
            >
              {activeHour !== null ? copy.more.reminderDisable : copy.more.reminderEnable}
            </button>
          </div>
          <p className="mt-2 text-xs text-faint">
            {activeHour !== null ? copy.more.reminderActive(activeHour) : copy.more.reminderHint}
          </p>
        </>
      )}
    </Card>
  )
}

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
  /** Beim Umbenennen vorbelegter Wert — bei verdeckten Habits der echte Name. */
  editLabel?: string
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
                className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-base outline-none focus:border-track"
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
                    setEditVal(item.editLabel ?? item.label)
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
          className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-base outline-none focus:border-track"
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
      {status.state === 'error' && status.lastError && (
        <p className="mt-2 break-words text-xs text-slip-deep">{status.lastError}</p>
      )}
    </Card>
  )
}

export function More() {
  const habits = useLiveQuery(
    async () => sortHabits(await db.habits.toArray()),
    [],
  )
  const tags = useLiveQuery(
    async () => sortTags(await db.tags.toArray()),
    [],
  )
  const { cloud, session, signOut } = useAuth()
  const [newSameDay, setNewSameDay] = useState(false)
  const revealed = useRevealed()

  async function removeHabit(id: string) {
    try {
      await deleteHabitEverywhere(id)
    } catch {
      window.alert(copy.more.habitDeleteOnlineOnly)
    }
  }

  async function handleSignOut() {
    try {
      await signOut()
    } catch {
      window.alert(copy.more.signOutUnsyncedError)
    }
  }

  return (
    <div>
      <PageTitle title={copy.tabs.more} />
      <Card>
        <SectionLabel>{copy.more.habits}</SectionLabel>
        <NameList
          items={(habits ?? []).map((h) => ({
            id: h.id,
            label: displayName(h, revealed),
            editLabel: h.name,
          }))}
          addPlaceholder={copy.more.addHabit}
          onAdd={(name) => addHabit(name, newSameDay)}
          onRename={renameHabit}
          onDelete={removeHabit}
          confirmMsg={copy.more.deleteHabitConfirm}
          renderMeta={(item) => {
            const liste = habits ?? []
            const i = liste.findIndex((h) => h.id === item.id)
            if (i === -1 || liste.length < 2) return null
            return (
              <>
                <IconButton
                  label={copy.more.moveUp}
                  onClick={() => void (i > 0 && moveHabit(item.id, -1))}
                >
                  <path d="m6 14 6-6 6 6" />
                </IconButton>
                <IconButton
                  label={copy.more.moveDown}
                  onClick={() => void (i < liste.length - 1 && moveHabit(item.id, 1))}
                >
                  <path d="m6 10 6 6 6-6" />
                </IconButton>
              </>
            )
          }}
          addExtra={<LogModeChips value={newSameDay} onChange={setNewSameDay} />}
        />
      </Card>
      <HabitOptions habits={habits ?? []} />
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
      <AppearanceCard />
      <ReminderCard />
      <SyncCard />
      {cloud && session && (
        <Card className="mt-3">
          <SectionLabel>{copy.more.account}</SectionLabel>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm text-soft">{session.user.email}</span>
            <button
              type="button"
              onClick={() => void handleSignOut()}
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
        {copy.appName} · {copy.more.build(fmtTime(APP_BUILD.date), APP_BUILD.commit)}
      </p>
    </div>
  )
}
