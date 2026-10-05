import { expect, type Locator, type Page } from '@playwright/test'
import { fieldByLabel } from '../utils/field'

/** / · Despacho: órdenes de la IA, KPIs y libro de medidores por severidad. */
export class DashboardPage {
  readonly heading: Locator
  readonly orders: Locator
  readonly kpis: Locator
  readonly ledger: Locator

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Despacho' })
    this.orders = page.getByRole('region', { name: 'Órdenes emitidas por la IA' })
    this.kpis = page.getByRole('region', { name: 'Estado de la planta' })
    this.ledger = page.getByRole('table', { name: 'Medidores ordenados por severidad' })
  }

  async goto(): Promise<void> {
    await this.page.goto('/')
    await expect(this.heading).toBeVisible()
  }

  /** La orden de prioridad 1 (tarjeta grande, article con el meter_id como nombre). */
  leadOrder(meterId: string): Locator {
    return this.orders.getByRole('article', { name: meterId })
  }

  /** Casilla de un KPI ("Medidores", "Anomalías IA", "Alta prioridad"...). */
  kpi(label: string): Locator {
    return fieldByLabel(this.kpis, label)
  }

  confidenceMeter(): Locator {
    return this.kpis.getByRole('meter', { name: 'Confianza promedio de la IA' })
  }
}
