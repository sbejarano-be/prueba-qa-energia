/**
 * Oráculo de formato es-CO, escrito a mano y NO con el Intl del navegador:
 * si la app formatea distinto en algún motor, la diferencia debe salir como hallazgo.
 *
 * Fuentes: README.md ("+110,5 %", "2.207,6 kWh"), frontend/README.md ("formato es-CO",
 * "Las fechas del dataset son hora de planta: se muestran tal como vienen").
 */

/** 2207.6 → "2.207,6" · punto de miles, coma decimal. */
export function esNumber(value: number, decimals: number): string {
  const fixed = Math.abs(value).toFixed(decimals)
  const [int, frac] = fixed.split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const sign = value < 0 && Number(fixed) !== 0 ? '-' : ''
  return `${sign}${grouped}${frac ? `,${frac}` : ''}`
}

/** 2207.6 → "2.207,6 kWh" */
export const kwh = (value: number, decimals = 1): string => `${esNumber(value, decimals)} kWh`

/** 109.82 → "+109,8 %" (el signo menos se normaliza con `normalizeMinus` al comparar). */
export function pct(value: number, decimals = 1): string {
  const rounded = Number(value.toFixed(decimals))
  const sign = rounded > 0 ? '+' : rounded < 0 ? '-' : ''
  return `${sign}${esNumber(Math.abs(rounded), decimals)} %`
}

/** 0.95 → "0,95" */
export const confidence = (value: number): string => esNumber(value, 2)

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Hora de planta: la API la entrega como ISO con "Z" pero es la hora local de la planta,
 * así que se muestra con las partes UTC, sin convertirla a la zona del navegador.
 * "2026-09-12T14:00:00Z" → "12/09 14:00"
 */
export function plantTime(iso: string): string {
  const d = new Date(iso)
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

/** Unifica U+2212 (−) y el guion para comparar cifras con signo. */
export const normalizeMinus = (text: string): string => text.replace(/−/g, '-')

/** Colapsa espacios (incluido el NBSP que usa Intl) para comparar textos de la UI. */
export const normalizeSpaces = (text: string): string => text.replace(/[\s  ]+/g, ' ').trim()

/** Convierte "2.207,6 kWh" o "+109,8 %" a número (para comparar con tolerancia). */
export function parseEsNumber(text: string): number {
  const match = normalizeMinus(text).match(/[-+]?[\d.]+(?:,\d+)?/)
  if (!match) throw new Error(`No hay número en "${text}"`)
  return Number(match[0].replace(/\./g, '').replace(',', '.'))
}
