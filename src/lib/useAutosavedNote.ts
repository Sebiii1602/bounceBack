import { useCallback, useEffect, useRef, useState } from 'react'

interface Draft {
  text: string
  /** Wurde der gespeicherte Stand schon übernommen? */
  adopted: boolean
}

/**
 * Notizfeld, das von selbst speichert: kurz nach dem letzten Tastendruck und
 * spätestens beim Verlassen — Sheet zugezogen, Tab gewechselt, App auf dem
 * iPhone weggewischt. Eine Notiz darf nie daran scheitern, dass das Feld nicht
 * ordentlich verlassen wurde.
 *
 * `text` und `adopted` liegen bewusst in *einem* State: als getrenntes Ref war
 * „übernommen“ eine Runde früher wahr als der Text da war — das leere Feld galt
 * dann als Änderung und hat eine bestehende Notiz überschrieben.
 *
 * @param persisted  gespeicherter Stand (kommt bei lokalen Queries verzögert)
 * @param ready      true, sobald `persisted` wirklich geladen ist
 * @param resetKey   wechselt er, fängt das Feld von vorn an (anderer Tag/Eintrag)
 */
export function useAutosavedNote(
  persisted: string,
  ready: boolean,
  resetKey: string,
  save: (text: string) => Promise<void>,
): { value: string; setValue: (v: string) => void; flush: () => void } {
  const [draft, setDraft] = useState<Draft>({ text: '', adopted: false })
  const pending = useRef<string | null>(null)
  const saveRef = useRef(save)
  saveRef.current = save

  useEffect(() => {
    setDraft({ text: '', adopted: false })
  }, [resetKey])

  // Gespeicherten Stand genau einmal übernehmen — danach gewinnt das Getippte
  useEffect(() => {
    if (!ready) return
    setDraft((d) => (d.adopted ? d : { text: persisted, adopted: true }))
  }, [ready, persisted])

  // Was noch nicht auf der Platte liegt
  useEffect(() => {
    pending.current = draft.adopted && draft.text !== persisted ? draft.text : null
  }, [draft, persisted])

  const flush = useCallback(() => {
    const text = pending.current
    if (text === null) return
    pending.current = null
    void saveRef.current(text)
  }, [])

  // Kurz nach dem Tippen sichern
  useEffect(() => {
    if (!draft.adopted || draft.text === persisted) return
    const timer = setTimeout(flush, 600)
    return () => clearTimeout(timer)
  }, [draft, persisted, flush])

  // Beim Verlassen sofort sichern — auch wenn die App weggewischt wird
  useEffect(() => {
    const onHidden = (): void => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])

  const setValue = useCallback((text: string) => {
    setDraft({ text, adopted: true })
  }, [])

  return { value: draft.text, setValue, flush }
}
