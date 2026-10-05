import { expect, type Locator, type Page } from '@playwright/test'
import { fieldByLabel } from '../utils/field'

/** /anomalias/:id · Orden de trabajo completa de una anomalía. */
export class InvestigationPage {
  readonly action: Locator

  constructor(private readonly page: Page) {
    this.action = page.getByRole('region', { name: 'Acción recomendada' })
  }

  async goto(meterId: string): Promise<void> {
    await this.page.goto(`/anomalias/${meterId}`)
  }

  order(meterId: string): Locator {
    return this.page.getByRole('article', { name: meterId, exact: true })
  }

  async waitFor(meterId: string): Promise<void> {
    await expect(this.page.getByRole('heading', { level: 1, name: meterId, exact: true })).toBeVisible()
  }

  /** "Orden de trabajo · Prioridad 1 de 4". */
  priorityText(meterId: string): Locator {
    return this.order(meterId).getByText(/^Orden de trabajo · Prioridad/)
  }

  /** "Detectada 12/09 14:00 · hora de planta". */
  detectedAt(meterId: string): Locator {
    return this.order(meterId).getByText(/^Detectada .* · hora de planta$/)
  }

  /** Hoja de una sección, por el texto de su h2. */
  sheet(title: string): Locator {
    return this.page.locator('section').filter({ has: this.page.getByRole('heading', { level: 2, name: title, exact: true }) })
  }

  /** Texto `reason` del motor (hoja "Qué encontró la IA"). */
  reason(): Locator {
    return this.sheet('Qué encontró la IA').getByRole('paragraph').last()
  }

  /** Medidor de confianza de la cabecera (dentro de su <dl>; la hoja "Evidencia y confianza" repite otro más abajo). */
  confidence(meterId: string): Locator {
    return this.order(meterId).getByRole('definition').getByRole('meter', { name: 'Confianza' })
  }

  /** Casilla de la comparación contra baseline ("Duración", "Esperado en la ventana"...). */
  windowFact(label: string): Locator {
    return fieldByLabel(this.sheet('Comparación contra baseline'), label)
  }

  /** La cuenta de la confianza: "0,5 + 0,45 × 1,000 × 0,9 = 0,86". */
  confidenceFormula(): Locator {
    return this.sheet('Evidencia y confianza').getByText(/^0,5 \+ 0,45 ×/)
  }
}
