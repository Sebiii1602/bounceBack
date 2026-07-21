import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addTag, db } from '../lib/db'
import { copy } from '../lib/copy'

/** Trigger-Chips: 1 Tap zum Togglen, „+“ legt inline einen eigenen Tag an. */
export function TagPicker({
  selected,
  onToggle,
}: {
  selected: string[]
  onToggle: (label: string) => void
}) {
  const tags =
    useLiveQuery(
      async () => (await db.tags.toArray()).sort((a, b) => a.created_at.localeCompare(b.created_at)),
      [],
    ) ?? []
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  async function submitNew() {
    const tag = await addTag(draft)
    if (tag && !selected.includes(tag.label)) onToggle(tag.label)
    setDraft('')
    setAdding(false)
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => {
        const active = selected.includes(tag.label)
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => onToggle(tag.label)}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              active ? 'border-ink bg-ink text-card' : 'border-line bg-card text-soft'
            }`}
          >
            {tag.label}
          </button>
        )
      })}
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submitNew()
          }}
          className="inline-flex"
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft.trim() === '') setAdding(false)
            }}
            placeholder={copy.today.newTagPlaceholder}
            className="w-40 rounded-full border border-line bg-card px-3 py-1.5 text-base outline-none focus:border-track"
          />
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-full border border-dashed border-faint px-3 py-1.5 text-sm text-soft"
        >
          {copy.today.addTagChip}
        </button>
      )}
    </div>
  )
}
