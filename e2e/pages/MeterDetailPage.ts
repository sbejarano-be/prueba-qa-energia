import { expect, type Locator, type Page } from '@playwright/test'
import { fieldByLabel } from '../utils/field'

/** /medidores/:id · Detalle del medidor. */
export class MeterDetailPage {
  readonly breadcrumb: Locator
  readonly openInvestigation: Locator

  constructor(private readonly page: Page) {
    this.breadcrumb = page.getByRole('navigation', { name: 'Ruta' })
    this.openInvestigation = page.getByRole('link', { name: 'Abrir investigación' })
  }

  async goto(meterId: string): Promise<void> {
    await this.page.goto(`/medidores/${meterId}`)
  }

  heading(meterId: string): Locator {
    return this.page.getByRole('heading', { level: 1, name: meterId, exact: true })
  }

  /** Cabecera del medidor: región etiquetada por el h1 (meter_id). */
  header(meterId: string): Locator {
    return this.page.getByRole('region', { name: meterId, exact: true })
  }

  async waitFor(meterId: string): Promise<void> {
    await expect(this.heading(meterId)).toBeVisible()
  }

  /** Sello o texto de estado junto al h1: "Crítica", "Alerta" o "Normal". */
  status(meterId: string): Locator {
    return this.header(meterId).getByText(/^(Crítica|Alerta|Normal)$/)
  }

  lastReading(meterId: string): Locator {
    return this.header(meterId).getByText(/^Última lectura/)
  }

  field(meterId: string, label: 'Consumo actual · 24 h' | 'Baseline diario' | 'Variación' | 'Severidad'): Locator {
    return fieldByLabel(this.header(meterId), label)
  }

  /** Encabezado de la orden: "Orden 1 · Anomalía real · Investigar". */
  orderHeading(): Locator {
    return this.page.getByRole('heading', { level: 2, name: /^Orden \d+ ·/ })
  }

  noOrderMessage(): Locator {
    return this.page.getByText(/^Sin órdenes para este medidor/)
  }
}
