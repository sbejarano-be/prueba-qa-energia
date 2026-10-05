import { expect, type Locator, type Page } from '@playwright/test'
import { rowHeaderTexts } from '../utils/table'

export type StatusTab = 'Todos' | 'Normales' | 'Alertas' | 'Críticas'
export type SortLabel = 'Medidor' | 'Consumo' | 'Variación' | 'Severidad'

/** /medidores · Libro de medidores con filtros en la URL. */
export class MetersPage {
  readonly heading: Locator
  readonly statusGroup: Locator
  readonly search: Locator
  readonly searchButton: Locator
  readonly sortBy: Locator
  readonly direction: Locator
  readonly table: Locator
  readonly pagination: Locator
  readonly next: Locator
  readonly previous: Locator
  readonly emptyState: Locator
  readonly clearFilters: Locator

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Libro de medidores' })
    this.statusGroup = page.getByRole('group', { name: 'Estado' })
    // El input tiene datalist (sugerencias), por eso su rol es combobox.
    this.search = page.getByRole('combobox', { name: 'Medidor' })
    this.searchButton = page.getByRole('button', { name: 'Buscar medidor' })
    this.sortBy = page.getByRole('combobox', { name: 'Ordenar por' })
    this.direction = page.getByRole('button', { name: /^Dirección:/ })
    this.table = page.getByRole('table', { name: 'Medidores filtrados' })
    this.pagination = page.getByRole('navigation', { name: 'Paginación' })
    this.next = this.pagination.getByRole('button', { name: 'Siguiente' })
    this.previous = this.pagination.getByRole('button', { name: 'Anterior' })
    this.emptyState = page.getByText('Ningún medidor coincide con los filtros')
    this.clearFilters = page.getByRole('button', { name: 'Quitar filtros' })
  }

  async goto(query = ''): Promise<void> {
    await this.page.goto(`/medidores${query}`)
    await expect(this.heading).toBeVisible()
  }

  /** Espera a que la tabla tenga filas reales (no las de carga). */
  async waitForRows(): Promise<void> {
    await expect(this.table.getByRole('rowheader').first()).toBeVisible()
  }

  statusRadio(tab: StatusTab): Locator {
    return this.statusGroup.getByRole('radio', { name: tab })
  }

  /** Los radios son sr-only: se hace clic en su etiqueta visible, como un usuario. */
  async filterByStatus(tab: StatusTab): Promise<void> {
    await this.statusGroup.getByText(tab, { exact: true }).click()
    await expect(this.statusRadio(tab)).toBeChecked()
  }

  /** Busca por texto y confirma con el botón (la búsqueda no es en vivo). */
  async searchMeter(text: string): Promise<void> {
    await this.search.fill(text)
    await this.searchButton.click()
  }

  async sort(label: SortLabel, order: 'ASC' | 'DESC'): Promise<void> {
    await this.sortBy.selectOption({ label })
    const wanted = order === 'ASC' ? 'de menor a mayor' : 'de mayor a menor'
    const current = await this.direction.getAttribute('aria-label')
    if (!current?.includes(wanted)) await this.direction.click()
    await expect(this.direction).toHaveAccessibleName(new RegExp(wanted))
  }

  /** Los meter_id visibles, en orden. */
  meterIds(): Promise<string[]> {
    return rowHeaderTexts(this.table)
  }

  /** Fila de un medidor, por su encabezado de fila. */
  row(meterId: string): Locator {
    return this.table.getByRole('row').filter({ has: this.page.getByRole('rowheader', { name: meterId, exact: true }) })
  }

  async openMeter(meterId: string): Promise<void> {
    await this.table.getByRole('link', { name: meterId, exact: true }).click()
  }

  /** Texto "1–10 de 12 medidores". */
  rangeText(): Locator {
    return this.pagination.getByText(/de \d+ medidores/)
  }
}
