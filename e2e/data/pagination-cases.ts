import { DATASET, LIMITS } from './oracle'

/**
 * Análisis de valores límite de la paginación de POST /meter/getAll.
 * Fuente: Swagger (Pagination: page minimum 1; size minimum 1, maximum 100) y backend/README
 * ("sin body devuelve la página 1 de 10"). Dataset: 12 medidores.
 */
export interface PageCase {
  id: string
  page?: number
  size?: number
  expectedStatus: number
  /** Filas esperadas en la página (si 200). */
  expectedRows?: number
  note: string
}

const total = DATASET.meters // 12

export const SIZE_CASES: readonly PageCase[] = [
  { id: 'S-min', size: 1, expectedStatus: 200, expectedRows: 1, note: 'Mínimo válido' },
  { id: 'S-min+1', size: 2, expectedStatus: 200, expectedRows: 2, note: 'Mínimo + 1' },
  { id: 'S-total', size: total, expectedStatus: 200, expectedRows: total, note: 'Justo el total' },
  { id: 'S-max', size: LIMITS.pageSizeMax, expectedStatus: 200, expectedRows: total, note: 'Máximo válido (100)' },
  { id: 'S-max+1', size: LIMITS.pageSizeMax + 1, expectedStatus: 400, note: 'Máximo + 1 → inválido' },
  { id: 'S-neg', size: -1, expectedStatus: 400, note: 'Negativo → inválido' },
]

export const PAGE_CASES: readonly PageCase[] = [
  { id: 'P-first', page: 1, size: 10, expectedStatus: 200, expectedRows: 10, note: 'Primera página' },
  { id: 'P-last', page: 2, size: 10, expectedStatus: 200, expectedRows: 2, note: 'Última página (parcial: 11–12)' },
  { id: 'P-last+1', page: 3, size: 10, expectedStatus: 200, expectedRows: 0, note: 'Fuera de rango → lista vacía, count 12' },
  { id: 'P-exact', page: 3, size: 4, expectedStatus: 200, expectedRows: 4, note: 'Última página exacta (12 = 3 × 4)' },
]

/** Clases inválidas de `page` (Swagger: minimum 1). Se esperan 400 con el formato de error. */
export const INVALID_PAGE_CASES: readonly PageCase[] = [
  { id: 'P-neg', page: -1, size: 10, expectedStatus: 400, note: 'Página negativa' },
  { id: 'P-neg-big', page: -100, size: 10, expectedStatus: 400, note: 'Página muy negativa' },
]
