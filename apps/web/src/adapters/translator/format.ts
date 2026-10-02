/**
 * Bytes as HAWKI writes them in every language: Bytes, KB, MB or GB with up to two decimals and
 * a decimal point, e.g. `35.83 KB`.
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const units = ['Bytes', 'KB', 'MB', 'GB']
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${parseFloat((bytes / 1024 ** exponent).toFixed(2))} ${units[exponent]}`
}

/**
 * A glossary's date as HAWKI shows it in every language: the day in US English, the time as in
 * German, e.g. `Oct 1, 2026 • 06:54`.
 */
export function formatGlossaryDate(value: string | Date): string {
  const date = new Date(value)
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return `${day} • ${time}`
}
