import type { Locator } from '@playwright/test'
import { normalizeSpaces } from './format'

export type TableRow = Record<string, string>

/**
 * Lee una tabla accesible como filas `{ encabezado: texto }`, solo con roles ARIA
 * (columnheader, row, rowheader, cell). Sirve para comparar la UI contra la API.
 * Las columnas ocultas por breakpoint no están en el árbol de accesibilidad y se omiten.
 */
export async function readTable(table: Locator): Promise<TableRow[]> {
  const headers = (await table.getByRole('columnheader').allInnerTexts()).map(normalizeSpaces)
  const rows = await table.getByRole('row').all()
  const result: TableRow[] = []

  for (const row of rows) {
    // rowheader (th scope=row) y cell en orden de documento.
    const cells = (await row.getByRole('rowheader').or(row.getByRole('cell')).allInnerTexts()).map(normalizeSpaces)
    if (cells.length !== headers.length) continue // fila de encabezado o fila de carga
    result.push(Object.fromEntries(headers.map((h, i) => [h, cells[i]])))
  }
  return result
}

/** Los textos de los encabezados de fila (en el libro de medidores, el meter_id). */
export async function rowHeaderTexts(table: Locator): Promise<string[]> {
  return (await table.getByRole('rowheader').allInnerTexts()).map(normalizeSpaces)
}
