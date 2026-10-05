import { EnergiaApi } from '../../api/energia-api'
import type { Anomaly, MeterSummary, Paged } from '../../api/types'
import { env } from '../../config/env'
import { defect, expect, test } from '../../fixtures/test'
import { apiEvidence } from '../../utils/evidence'

/**
 * Valores límite de los umbrales documentados del motor (backend/README · "Metodología").
 * El dataset real no toca ningún umbral, así que se usa un dataset sintético
 * (data/boundary, generado por scripts/generate-boundary-data.mjs) servido por una
 * segunda instancia del backend en BOUNDARY_API_URL. Cada medidor aísla un umbral.
 */
test.describe('Motor · valores límite de los umbrales', { tag: '@regression' }, () => {
  let api: EnergiaApi
  let anomalies: Anomaly[]
  let meters: MeterSummary[]

  test.beforeAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext()
    const up = await ctx.get(`${env.boundaryApiUrl}/health`).catch(() => null)
    test.skip(!up?.ok(), `Backend de valores límite no disponible en ${env.boundaryApiUrl}`)
    api = new EnergiaApi(ctx, await EnergiaApi.token(ctx, env.boundaryApiUrl), env.boundaryApiUrl)
    anomalies = (await (await api.anomalies()).json()) as Anomaly[]
    meters = ((await (await api.meters({ pagination: { size: 100 } })).json()) as Paged<MeterSummary>).rows
  })

  const anomalyOf = (id: string) => anomalies.find((a) => a.meter_id === id) ?? null
  const meterOf = (id: string) => meters.find((m) => m.meter_id === id)!

  test('BVA-01 · B-101 control (todo constante) → sin anomalía, NORMAL', () => {
    expect(anomalyOf('B-101')).toBeNull()
    expect(meterOf('B-101').status).toBe('NORMAL')
  })

  test('BVA-02 · B-103 +50,1 % y activo (justo encima de 50 %) → REAL_ANOMALY HIGH', () => {
    expect(anomalyOf('B-103')).toMatchObject({ type: 'REAL_ANOMALY', severity: 'HIGH' })
    expect(anomalyOf('B-103')!.evidence.change!.change_pct).toBeCloseTo(50.1, 1)
  })

  test('BVA-03 · B-105 +100 % solo 5 h seguidas (< 6 h) → no es cambio sostenido', () => {
    expect(anomalyOf('B-105')).toBeNull()
    expect(meterOf('B-105').status).toBe('NORMAL')
  })

  test('BVA-04 · B-106 voltaje +10 % durante 2 h (< 3 horas sospechosas) → sin anomalía', () => {
    expect(anomalyOf('B-106')).toBeNull()
  })

  test('BVA-05 · B-107 voltaje +10 % durante 3 h (= 3, umbral) → DATA_QUALITY MEDIUM (< 12 h)', () => {
    expect(anomalyOf('B-107')).toMatchObject({ type: 'DATA_QUALITY', severity: 'MEDIUM' })
    expect(anomalyOf('B-107')!.evidence.quality!.flagged_hours).toBe(3)
  })

  test.fail(
    'DEF-07 · BVA-06 · B-102 exactamente +50,0 % y activo → MEDIUM ("HIGH si la variación SUPERA 50 %")',
    defect('DEF-07', 'Severidad REAL_ANOMALY usa >= en vez de >'),
    async ({}, testInfo) => {
      await apiEvidence(testInfo, 'DEF-07-umbral-50-B-102', { method: 'GET', url: `${env.boundaryApiUrl}/api/v1/anomaly/getAll` }, await api.anomalies())
      const a = anomalyOf('B-102')!
      expect(a.evidence.change!.change_pct).toBeCloseTo(50, 6) // es exactamente el límite
      expect(a.severity).toBe('MEDIUM')
    },
  )

  test.fail(
    'DEF-07 · BVA-07 · B-104 exactamente +20,0 % y activo → LOW ("MEDIUM si SUPERA 20 %")',
    defect('DEF-07', 'Severidad REAL_ANOMALY usa >= en vez de >'),
    async () => {
      const a = anomalyOf('B-104')!
      expect(a.evidence.change!.change_pct).toBeCloseTo(20, 6)
      expect(a.severity).toBe('LOW')
    },
  )

  test.fail(
    'DEF-08 · BVA-08 · B-108 con UNA hora faltante → sin anomalía (calidad exige ≥ 3 horas sospechosas)',
    defect('DEF-08', 'Una sola hora faltante dispara DATA_QUALITY con explicación vacía'),
    async ({}, testInfo) => {
      const body = { filter: { meter_id: 'B-108' } }
      await apiEvidence(testInfo, 'DEF-08-hora-faltante-B-108-estado', { method: 'POST', url: `${env.boundaryApiUrl}/api/v1/meter/getAll`, body }, await api.meters(body))
      await apiEvidence(testInfo, 'DEF-08-hora-faltante-anomalias', { method: 'GET', url: `${env.boundaryApiUrl}/api/v1/anomaly/getAll` }, await api.anomalies())
      const a = anomalyOf('B-108')
      // Si el motor insiste en marcarlo, al menos la explicación no debería traer valores vacíos.
      expect.soft(a?.reason ?? '').not.toContain('0 h con lecturas')
      expect.soft(a?.reason ?? '').not.toContain('01/01 00:00')
      expect(a).toBeNull()
      expect(meterOf('B-108').status).toBe('NORMAL')
    },
  )
})
