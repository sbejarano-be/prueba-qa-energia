import type { ApiErrorBody, DashboardSummary, MeterSummary, Paged } from '../../api/types'
import { env } from '../../config/env'
import { EXPECTED_STATUS_BY_METER, EXPECTED_STATUS_COUNTS } from '../../data/oracle'
import { INVALID_PAGE_CASES } from '../../data/pagination-cases'
import { defect, expect, test } from '../../fixtures/test'
import { apiEvidence } from '../../utils/evidence'

/**
 * Defectos de la API. Cada test asevera el comportamiento DOCUMENTADO, así que hoy falla
 * (test.fail) y empezará a "pasar inesperadamente" cuando se corrija: en ese momento se
 * quita el test.fail y queda como prueba de regresión. Detalle en qa/05-defectos.md.
 */
const GET_ALL = `${env.apiUrl}/api/v1/meter/getAll`

test.describe('Defectos · API', () => {
  test.fail(
    'DEF-01 · CP-16 R2 · M-106 (FALSE_POSITIVE) debe estar NORMAL en la lista',
    defect('DEF-01', 'FALSE_POSITIVE se muestra como ALERT'),
    async ({ api }, testInfo) => {
      const body = { filter: { meter_id: 'M-106' } }
      const res = await api.meters(body)
      await apiEvidence(testInfo, 'DEF-01-M-106-status', { method: 'POST', url: GET_ALL, body }, res)
      const row = ((await res.json()) as Paged<MeterSummary>).rows[0]
      expect(row.anomaly_type).toBe('FALSE_POSITIVE')
      expect(row.status).toBe(EXPECTED_STATUS_BY_METER['M-106']) // NORMAL
    },
  )

  test.fail(
    'DEF-01 · CP-11 · filtro ALERT solo devuelve M-104 y NORMAL devuelve 9 medidores',
    defect('DEF-01', 'FALSE_POSITIVE se muestra como ALERT'),
    async ({ api }) => {
      const ids = async (status: string) =>
        ((await (await api.meters({ pagination: { size: 100 }, filter: { status } })).json()) as Paged<MeterSummary>).rows.map(
          (r) => r.meter_id,
        )
      expect.soft(await ids('ALERT')).toEqual(['M-104'])
      expect(await ids('NORMAL')).toHaveLength(EXPECTED_STATUS_COUNTS.normal)
    },
  )

  test.fail(
    'DEF-01 · CP-18 · dashboard: 9 normales · 1 alerta · 2 críticas',
    defect('DEF-01', 'FALSE_POSITIVE se muestra como ALERT'),
    async ({ api }, testInfo) => {
      const res = await api.dashboard()
      await apiEvidence(testInfo, 'DEF-01-dashboard-status-counts', { method: 'GET', url: `${env.apiUrl}/api/v1/dashboard/getSummary` }, res)
      expect(((await res.json()) as DashboardSummary).status_counts).toEqual(EXPECTED_STATUS_COUNTS)
    },
  )

  test.fail(
    'DEF-04 · CP-12 · la búsqueda por meter_id no distingue mayúsculas ("m-109" → M-109)',
    defect('DEF-04', 'Búsqueda meter_id sensible a mayúsculas'),
    async ({ api }, testInfo) => {
      const body = { filter: { meter_id: 'm-109' } }
      const res = await api.meters(body)
      await apiEvidence(testInfo, 'DEF-04-busqueda-minusculas', { method: 'POST', url: GET_ALL, body }, res)
      expect(((await res.json()) as Paged<MeterSummary>).rows.map((r) => r.meter_id)).toEqual(['M-109'])
    },
  )

  for (const c of INVALID_PAGE_CASES) {
    test.fail(
      `DEF-05 · CP-10 · ${c.id} · pagination.page=${c.page} → 400 "Filtros inválidos" (no 500)`,
      defect('DEF-05', 'Página negativa provoca 500'),
      async ({ api }, testInfo) => {
        const body = { pagination: { page: c.page, size: c.size } }
        const res = await api.meters(body)
        await apiEvidence(testInfo, `DEF-05-pagina-negativa${c.page}`, { method: 'POST', url: GET_ALL, body }, res)
        expect(res.status()).toBe(400)
        expect(((await res.json()) as ApiErrorBody).errors?.join(' ')).toContain('pagination.page')
      },
    )
  }

  test.fail(
    'DEF-09 · método HTTP incorrecto sobre una ruta existente → 405 con Allow (no 404 "Ruta no encontrada")',
    defect('DEF-09', 'Errores HTTP: 404 en vez de 405'),
    async ({ api }, testInfo) => {
      const res = await api.raw('GET', '/api/v1/meter/getAll')
      await apiEvidence(testInfo, 'DEF-09-metodo-incorrecto', { method: 'GET', url: GET_ALL }, res)
      expect(res.status()).toBe(405)
      expect(res.headers()['allow']).toContain('POST')
    },
  )

  test.fail(
    'DEF-09 · JSON malformado → 400 con "errors" y sin detalles internos del parser',
    defect('DEF-09', 'Errores de decode exponen el parser de Go y omiten "errors"'),
    async ({ anonymousApi }, testInfo) => {
      const res = await anonymousApi.login({ email: 1, password: 'x' })
      await apiEvidence(
        testInfo,
        'DEF-09-error-decode',
        { method: 'POST', url: `${env.apiUrl}/api/v1/auth/login`, body: { email: 1, password: 'x' }, anonymous: true },
        res,
      )
      const body = (await res.json()) as ApiErrorBody
      expect(res.status()).toBe(400)
      expect.soft(body.message).not.toMatch(/json:|Go struct|unmarshal/)
      expect(Array.isArray(body.errors)).toBe(true)
    },
  )
})
