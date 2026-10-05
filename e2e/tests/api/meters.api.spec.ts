import type { EnergiaApi } from '../../api/energia-api'
import type { ApiErrorBody, MeterDetail, MeterParams, MeterSummary, Paged } from '../../api/types'
import { DATASET, LIMITS, M109 } from '../../data/oracle'
import { PAGE_CASES, SIZE_CASES } from '../../data/pagination-cases'
import { expect, test } from '../../fixtures/test'

type List = Paged<MeterSummary>

test.describe('Medidores · getParams', { tag: '@regression' }, () => {
  test('CP-11 · getParams publica las opciones documentadas de estado y orden', async ({ api }) => {
    const res = await api.meterParams()
    expect(res.status()).toBe(200)
    const params = (await res.json()) as MeterParams
    expect(params.meters.map((m) => m.id)).toEqual([...DATASET.meterIds])
    expect(params.statuses.map((s) => s.id)).toEqual(['NORMAL', 'ALERT', 'CRITICAL'])
    expect(params.sort_fields.map((s) => s.id)).toEqual(['meter_id', 'consumption', 'variation', 'severity'])
    expect(params.sort_orders.map((s) => s.id)).toEqual(['ASC', 'DESC'])
  })
})

test.describe('Medidores · paginación (valores límite)', { tag: '@regression' }, () => {
  test('CP-09 · sin body → página 1 de 10, ordenada por medidor (README)', async ({ api }) => {
    const res = await api.meters()
    expect(res.status()).toBe(200)
    const body = (await res.json()) as List
    expect(body).toMatchObject({ page: 1, size: LIMITS.pageSizeDefault, count: DATASET.meters })
    expect(body.rows.map((r) => r.meter_id)).toEqual(DATASET.meterIds.slice(0, 10))
  })

  for (const c of SIZE_CASES) {
    test(`CP-09 · size ${c.id} (${c.size}) · ${c.note} → ${c.expectedStatus}`, async ({ api }) => {
      const res = await api.meters({ pagination: { page: 1, size: c.size } })
      expect(res.status()).toBe(c.expectedStatus)
      const body = await res.json()
      if (c.expectedStatus === 200) {
        expect((body as List).rows).toHaveLength(c.expectedRows!)
        expect((body as List).count).toBe(DATASET.meters)
      } else {
        expect((body as ApiErrorBody).message).toBe('Filtros inválidos')
        expect((body as ApiErrorBody).errors?.join(' ')).toContain('pagination.size')
      }
    })
  }

  for (const c of PAGE_CASES) {
    test(`CP-10 · page ${c.id} (page ${c.page}, size ${c.size}) · ${c.note}`, async ({ api }) => {
      const res = await api.meters({ pagination: { page: c.page, size: c.size } })
      expect(res.status()).toBe(c.expectedStatus)
      const body = (await res.json()) as List
      expect(body.page).toBe(c.page)
      expect(body.count).toBe(DATASET.meters)
      expect(body.rows).toHaveLength(c.expectedRows!)
    })
  }

  test('CP-10 · recorrer todas las páginas devuelve los 12 medidores sin repetir', async ({ api }) => {
    const seen: string[] = []
    for (let page = 1; page <= Math.ceil(DATASET.meters / 5); page++) {
      const body = (await (await api.meters({ pagination: { page, size: 5 } })).json()) as List
      seen.push(...body.rows.map((r) => r.meter_id))
    }
    expect(seen).toEqual([...DATASET.meterIds])
  })
})

test.describe('Medidores · filtros (partición de equivalencia)', { tag: '@regression' }, () => {
  const search = async (api: EnergiaApi, meterId: string) =>
    ((await (await api.meters({ pagination: { size: 100 }, filter: { meter_id: meterId } })).json()) as List).rows.map((r) => r.meter_id)

  test('CP-12 · búsqueda parcial: "109" y "M-109" encuentran solo M-109', async ({ api }) => {
    expect(await search(api, '109')).toEqual(['M-109'])
    expect(await search(api, 'M-109')).toEqual(['M-109'])
  })

  test('CP-12 · prefijo común "M-1" encuentra los 12; "M-11" encuentra M-110..M-112', async ({ api }) => {
    expect(await search(api, 'M-1')).toHaveLength(DATASET.meters)
    expect(await search(api, 'M-11')).toEqual(['M-110', 'M-111', 'M-112'])
  })

  test('CP-12 · texto sin coincidencias → 200 con lista vacía (no es error)', async ({ api }) => {
    const res = await api.meters({ filter: { meter_id: 'ZZZ' } })
    expect(res.status()).toBe(200)
    expect(await res.json()).toMatchObject({ count: 0, rows: [] })
  })

  test('CP-12 · meter_id de 50 caracteres (límite) es válido; de 51 → 400', async ({ api }) => {
    expect((await api.meters({ filter: { meter_id: 'X'.repeat(LIMITS.meterIdMaxChars) } })).status()).toBe(200)
    const res = await api.meters({ filter: { meter_id: 'X'.repeat(LIMITS.meterIdMaxChars + 1) } })
    expect(res.status()).toBe(400)
    expect(((await res.json()) as ApiErrorBody).errors?.join(' ')).toContain('meter_id')
  })

  test('CP-11 · status CRITICAL → exactamente M-109 y M-112 (las dos HIGH)', async ({ api }) => {
    const body = (await (await api.meters({ filter: { status: 'CRITICAL' } })).json()) as List
    expect(body.rows.map((r) => r.meter_id)).toEqual(['M-109', 'M-112'])
    expect(body.rows.every((r) => r.status === 'CRITICAL' && r.severity === 'HIGH')).toBe(true)
  })

  test('CP-11 · status fuera del dominio → 400 con el mensaje documentado', async ({ api }) => {
    const res = await api.meters({ filter: { status: 'ROJO' } })
    expect(res.status()).toBe(400)
    const body = (await res.json()) as ApiErrorBody
    expect(body).toMatchObject({ status_code: 400, message: 'Filtros inválidos', path: '/api/v1/meter/getAll' })
    expect(body.errors).toContain('filter.status debe ser NORMAL, ALERT o CRITICAL')
  })

  test('CP-11 · los filtros se combinan: CRITICAL + "112" → solo M-112', async ({ api }) => {
    const body = (await (await api.meters({ filter: { status: 'CRITICAL', meter_id: '112' } })).json()) as List
    expect(body.rows.map((r) => r.meter_id)).toEqual(['M-112'])
  })
})

test.describe('Medidores · ordenamiento', { tag: '@regression' }, () => {
  const all = async (api: EnergiaApi, sort_by: string, sort_order: string) =>
    ((await (await api.meters({ pagination: { size: 100 }, filter: { sort_by, sort_order } })).json()) as List).rows

  test('CP-13 · severity DESC: primero las 4 anomalías en orden HIGH, HIGH, MEDIUM, LOW', async ({ api }) => {
    const rows = await all(api, 'severity', 'DESC')
    expect(rows.slice(0, 4).map((r) => r.meter_id)).toEqual(['M-109', 'M-112', 'M-104', 'M-106'])
    expect(rows.slice(0, 4).map((r) => r.severity)).toEqual(['HIGH', 'HIGH', 'MEDIUM', 'LOW'])
    expect(rows.slice(4).every((r) => r.severity === null)).toBe(true)
  })

  const numeric: [string, keyof MeterSummary][] = [
    ['consumption', 'consumption_kwh'],
    ['variation', 'variation_pct'],
  ]
  for (const [sortBy, field] of numeric) {
    for (const order of ['ASC', 'DESC'] as const) {
      test(`CP-13 · ${sortBy} ${order} devuelve la lista monótona`, async ({ api }) => {
        const values = (await all(api, sortBy, order)).map((r) => r[field] as number)
        const sorted = [...values].sort((a, b) => (order === 'ASC' ? a - b : b - a))
        expect(values).toEqual(sorted)
      })
    }
  }

  test('CP-13 · consumption DESC y variation DESC ponen a M-109 primero (mayor consumo y variación)', async ({ api }) => {
    expect((await all(api, 'consumption', 'DESC'))[0].meter_id).toBe('M-109')
    expect((await all(api, 'variation', 'DESC'))[0].meter_id).toBe('M-109')
  })

  test('CP-13 · meter_id DESC invierte el orden por defecto', async ({ api }) => {
    expect((await all(api, 'meter_id', 'DESC')).map((r) => r.meter_id)).toEqual([...DATASET.meterIds].reverse())
  })

  test('CP-13 · sort_by y sort_order inválidos → 400 con un error por campo', async ({ api }) => {
    const res = await api.meters({ filter: { sort_by: 'precio', sort_order: 'ARRIBA' } })
    expect(res.status()).toBe(400)
    const errors = ((await res.json()) as ApiErrorBody).errors ?? []
    expect(errors.some((e) => e.startsWith('filter.sort_by'))).toBe(true)
    expect(errors.some((e) => e.startsWith('filter.sort_order'))).toBe(true)
  })
})

test.describe('Medidores · detalle', { tag: '@regression' }, () => {
  test('CP-14 · M-109: consumo, baseline y variación coinciden con el README', async ({ api }) => {
    const res = await api.meter(M109.id)
    expect(res.status()).toBe(200)
    const m = (await res.json()) as MeterDetail
    expect(m.consumption_kwh).toBeCloseTo(M109.consumptionKwh, 1)
    expect(m.baseline_kwh).toBeCloseTo(M109.baselineKwh, 2)
    expect(m.variation_pct).toBeCloseTo(M109.variationPct, 1)
    expect(m.status).toBe('CRITICAL')
    expect(m.anomaly?.type).toBe('REAL_ANOMALY')
    // 14 días × 24 h de historia horaria y 14 totales diarios.
    expect(m.hourly_history).toHaveLength(DATASET.days * 24)
    expect(m.daily_history).toHaveLength(DATASET.days)
  })

  test('CP-14 · consistencia interna: "consumo" = total del último día del histórico', async ({ api }) => {
    for (const id of ['M-101', 'M-104', 'M-109', 'M-112']) {
      const m = (await (await api.meter(id)).json()) as MeterDetail
      expect(m.daily_history.at(-1)!.consumption_kwh, id).toBeCloseTo(m.consumption_kwh, 1)
      const last24 = m.hourly_history.slice(-24).reduce((s, p) => s + p.consumption_kwh, 0)
      expect(last24, id).toBeCloseTo(m.consumption_kwh, 1)
    }
  })

  test('CP-14 · lista y detalle devuelven las mismas cifras para los 12 medidores', async ({ api }) => {
    const list = ((await (await api.meters({ pagination: { size: 100 } })).json()) as List).rows
    for (const row of list) {
      const detail = (await (await api.meter(row.meter_id)).json()) as MeterDetail
      expect(detail, row.meter_id).toMatchObject({ ...row })
    }
  })

  test('CP-14 · medidor inexistente → 404 con el formato de error', async ({ api }) => {
    const res = await api.meter('M-999')
    expect(res.status()).toBe(404)
    expect(await res.json()).toMatchObject({ status_code: 404, path: '/api/v1/meter/getById/M-999' })
  })
})
