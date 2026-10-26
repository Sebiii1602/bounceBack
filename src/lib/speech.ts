/**
 * Vorlesen über die Sprachausgabe des Browsers. Bewusst kein Audio-Download:
 * kostet nichts, braucht keinen Speicher und funktioniert offline.
 */
export const speechSupported = (): boolean =>
  typeof window !== 'undefined' && 'speechSynthesis' in window

/** Liest `text` vor und bricht dabei eine noch laufende Ausgabe ab. */
export function speak(text: string, lang: string): void {
  if (!speechSupported()) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  // Etwas langsamer als normal — es geht ums Mitlesen, nicht ums Tempo
  utterance.rate = 0.9
  // Passende Stimme nehmen, falls das Gerät eine hat
  const stimme = window.speechSynthesis
    .getVoices()
    .find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang.slice(0, 2)))
  if (stimme) utterance.voice = stimme
  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel()
}
