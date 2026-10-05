import type { Locator, Page } from '@playwright/test'

/** Hoja de Run AI Analysis: no es un modal, es una región bajo la barra superior. */
export class AnalysisSheet {
  readonly root: Locator
  readonly steps: Locator
  readonly summary: Locator
  readonly viewOrders: Locator
  readonly close: Locator
  readonly failure: Locator

  constructor(page: Page) {
    this.root = page.getByRole('region', { name: /Análisis de IA/ })
    this.steps = this.root.getByRole('listitem')
    this.summary = this.root.getByRole('status')
    this.viewOrders = this.root.getByRole('link', { name: 'Ver órdenes' })
    this.close = this.root.getByRole('button', { name: 'Cerrar la hoja del análisis' })
    this.failure = this.root.getByRole('alert')
  }

  /** Paso n (1..7) por su etiqueta: "1 · Lecturas". */
  step(label: string): Locator {
    return this.steps.filter({ hasText: label })
  }
}
