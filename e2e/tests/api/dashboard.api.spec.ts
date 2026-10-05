import type { Anomaly, DashboardSummary, MeterSummary, Paged } from '../../api/types'
import { DATASET, EXPECTED_ANOMALIES, REQUIRING_ATTENTION } from '../../data/oracle'
import { expect, test } from '../../fixtures/test'

test.describe('Dashboard · resumen (consistencia entre endpoints)', { tag: '@regression' }, () => {
  let summary: DashboardSummary

  test.beforeEach(async ({ api }) => {
    const res = await api.dashboard()
    expect(res.status()).toBe(200)
    summary = (await res.json()) as DashboardSummary
  })

  test('CP-18 · KPIs del README: 12 medidores · 4 anomalías · 2 requieren atención', async () => {
    expect(summary.total_meters).toBe(DATASET.meters)
    expect(summary.anomalies_detected).toBe(EXPECTED_ANOMALIES.length)
    expect(summary.requiring_attention).toBe(REQUIRING_ATTENTION)
    expect(summary.anomalies_by_type).toEqual({ REAL_ANOMALY: 1, EXPLAINABLE_ANOMALY: 1, FALSE_POSITIVE: 1, DATA_QUALITY: 1 })
    expect(summary.data_range).toEqual({ from: DATASET.from, to: DATASET.to })
  })

  test('CP-18 · status_counts suma 12 y coincide con el filtro por estado de getAll', async ({ api }) => {
    const { normal, alert, critical } = summary.status_counts
    expect(normal + alert + critical).toBe(DATASET.meters)
    for (const [status, count] of [['NORMAL', normal], ['ALERT', alert], ['CRITICAL', critical]] as const) {
      const body = (await (await api.meters({ pagination: { size: 100 }, filter: { status } })).json()) as Paged<MeterSummary>
      expect(body.count, status).toBe(count)
    }
  })

  test('CP-18 · Confianza IA = promedio de la confianza de las anomalías', async ({ api }) => {
    const anomalies = (await (await api.anomalies()).json()) as Anomaly[]
    const mean = anomalies.reduce((s, a) => s + a.confidence, 0) / anomalies.length
    expect(Math.abs(summary.ai_confidence - mean)).toBeLessThanOrEqual(0.0051) // redondeo a 2 decimales
  })

  test('CP-18 · consumo de las últimas 24 h = suma del consumo de los 12 medidores', async ({ api }) => {
    const rows = ((await (await api.meters({ pagination: { size: 100 } })).json()) as Paged<MeterSummary>).rows
    const sum = rows.reduce((s, r) => s + r.consumption_kwh, 0)
    expect(summary.consumption.last_day_kwh).toBeCloseTo(sum, 0)
    expect(summary.priorities.map((p) => p.meter_id)).toEqual(EXPECTED_ANOMALIES.map((e) => e.meterId))
  })
})
