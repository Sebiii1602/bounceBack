import { useEffect, useLayoutEffect, useRef, type ComponentPropsWithoutRef } from 'react'

/**
 * Textfeld, das mit dem Text mitwächst statt nach drei Zeilen abzuschneiden —
 * ab `maxRows` scrollt es intern weiter. Für Notizen, die auch mal länger
 * werden dürfen (Tagebuch statt Stichwort).
 */
export function AutoTextarea({
  value,
  minRows = 3,
  maxRows = 14,
  className = '',
  ...rest
}: Omit<ComponentPropsWithoutRef<'textarea'>, 'rows'> & {
  value: string
  minRows?: number
  maxRows?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function resize(el: HTMLTextAreaElement): void {
    const style = window.getComputedStyle(el)
    const line = parseFloat(style.lineHeight) || 22
    const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
    const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
    const min = line * minRows + padding + border
    const max = line * maxRows + padding + border
    el.style.height = 'auto'
    const next = Math.min(Math.max(el.scrollHeight + border, min), max)
    el.style.height = `${next}px`
    el.style.overflowY = el.scrollHeight + border > max ? 'auto' : 'hidden'
  }

  // Beim ersten Rendern und bei jeder Wertänderung (auch von außen) nachmessen
  useLayoutEffect(() => {
    if (ref.current) resize(ref.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, minRows, maxRows])

  // Schriftgröße/Breite können sich beim Drehen des Geräts ändern
  useEffect(() => {
    const onResize = (): void => {
      if (ref.current) resize(ref.current)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <textarea
      {...rest}
      ref={ref}
      value={value}
      className={`w-full resize-none rounded-xl border border-line bg-paper px-3.5 py-2.5 text-base leading-relaxed outline-none focus:border-track ${className}`}
    />
  )
}
