import { expect, type Locator, type Page } from '@playwright/test'
import { readTable, type TableRow } from '../utils/table'

/** /anomalias · Anomalías IA ordenadas por prioridad. */
export class AnomaliesPage {
  readonly heading: Locator
  readonly table: Locator

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Anomalías IA' })
    this.table = page.getByRole('table', { name: 'Anomalías detectadas por la IA, ordenadas por prioridad' })
  }

  async goto(): Promise<void> {
    await this.page.goto('/anomalias')
    await expect(this.heading).toBeVisible()
    await expect(this.table.getByRole('rowheader').first()).toBeVisible()
  }

  rows(): Promise<TableRow[]> {
    return readTable(this.table)
  }

  async open(meterId: string): Promise<void> {
    await this.table.getByRole('link', { name: meterId, exact: true }).click()
  }
}
