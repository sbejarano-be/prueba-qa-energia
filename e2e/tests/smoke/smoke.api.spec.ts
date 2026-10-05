import type { Anomaly, Paged, MeterSummary, TokenResponse } from '../../api/types'
import { env } from '../../config/env'
import { DATASET, EXPECTED_ANOMALIES } from '../../data/oracle'
import { expect, test } from '../../fixtures/test'

/**
 * Suite de humo (API): lo mínimo para decir "este build se puede probar".
 * Justificación de cada caso en qa/02-smoke.md.
 */
test.describe('Smoke · API', { tag: '@smoke' }, () => {
  test('SMK-01 · el backend responde /health', async ({ anonymousApi }) => {
    const res = await anonymousApi.health()
    expect(res.status()).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  test('SMK-02 · el login del operador devuelve un JWT Bearer', async ({ anonymousApi }) => {
    const res = await anonymousApi.login({ email: env.credentials.email, password: env.credentials.password })
    expect(res.status()).toBe(200)
    const body = (await res.json()) as TokenResponse
    expect(body.token_type).toBe('Bearer')
    expect(body.access_token.split('.')).toHaveLength(3) // header.payload.firma
    expect(body.user.email).toBe(env.credentials.email)
  })

  test('SMK-03 · una ruta protegida sin token responde 401', async ({ anonymousApi }) => {
    const res = await anonymousApi.meters()
    expect(res.status()).toBe(401)
  })

  test('SMK-04 · los 12 medidores del dataset están cargados', async ({ api }) => {
    const res = await api.meters({ pagination: { page: 1, size: 100 } })
    expect(res.status()).toBe(200)
    const body = (await res.json()) as Paged<MeterSummary>
    expect(body.count).toBe(DATASET.meters)
    expect(body.rows.map((r) => r.meter_id).sort()).toEqual([...DATASET.meterIds])
  })

  test('SMK-05 · el motor detectó las 4 anomalías con M-109 en prioridad 1', async ({ api }) => {
    const res = await api.anomalies()
    expect(res.status()).toBe(200)
    const anomalies = (await res.json()) as Anomaly[]
    expect(anomalies).toHaveLength(EXPECTED_ANOMALIES.length)
    expect(anomalies[0]).toMatchObject({ meter_id: 'M-109', priority: 1, type: 'REAL_ANOMALY' })
  })
})
