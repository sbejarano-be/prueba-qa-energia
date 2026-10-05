import { expect, type Locator } from '@playwright/test'
import { normalizeSpaces, parseEsNumber } from './format'

type Unit = 'kWh' | '%' | 'MWh'

/**
 * Valida una cifra de la UI contra el valor de la API:
 *  1. Formato es-CO: punto de miles, coma decimal, `decimals` decimales y la unidad.
 *  2. Valor: a menos de media unidad del último decimal (no depende del modo de redondeo:
 *     Intl redondea 662,65 → 662,7 y toFixed → 662,6; ambos son representaciones válidas).
 */
export async function expectQuantity(source: Locator | string, value: number, unit: Unit, decimals = 1): Promise<void> {
  const text = normalizeSpaces(typeof source === 'string' ? source : await source.innerText())
  const re = new RegExp(`([+\\-\\u2212]?\\d{1,3}(?:\\.\\d{3})*,\\d{${decimals}}) ?${unit}`)
  const match = text.match(re)
  expect(match, `"${text}" debe contener una cifra es-CO con ${decimals} decimal(es) en ${unit}`).not.toBeNull()

  const shown = parseEsNumber(match![1])
  const tolerance = 0.5 * 10 ** -decimals + 1e-9
  expect(Math.abs(shown - value), `UI "${match![0]}" vs API ${value}`).toBeLessThanOrEqual(tolerance)

  if (unit === '%' && Math.abs(value) >= 0.05) {
    // La variación lleva signo explícito: "+109,8 %" / "−79,8 %".
    expect(match![1], `signo de "${match![0]}"`).toMatch(value > 0 ? /^\+/ : /^[-−]/)
  }
}
