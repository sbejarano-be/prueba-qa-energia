import type { Anomaly, DashboardSummary, MeterDetail } from '../../api/types'
import { DATASET, EXPECTED_ANOMALIES, REQUIRING_ATTENTION } from '../../data/oracle'
import { expect, test } from '../../fixtures/test'
import { expectQuantity } from '../../utils/assertions'

/** Consistencia entre capas: lo que muestra la UI = lo que devuelve la API = lo que dice la documentación. */
test.describe('Consistencia UI · API · documentación', { tag: '@regression' }, () => {
  test('CP-18 · KPIs del Despacho = API (Medidores, Anomalías IA, Alta prioridad, Confianza IA)', async ({ dashboard, api }) => {
    const s = (await (await api.dashboard()).json()) as DashboardSummary
    // API = documentación
    expect(s.total_meters).toBe(DATASET.meters)
    expect(s.anomalies_detected).toBe(EXPECTED_ANOMALIES.length)
    expect(s.requiring_attention).toBe(REQUIRING_ATTENTION)

    await dashboard.goto()
    await expect(dashboard.kpi('Medidores')).toContainText(String(s.total_meters))
    // La nota de la UI refleja exactamente los conteos de la API (sean cuales sean).
    const { normal, alert, critical } = s.status_counts
    await expect(dashboard.kpi('Medidores')).toContainText(`${normal} normales · ${alert} alerta · ${critical} críticas`)
    await expect(dashboard.kpi('Anomalías IA')).toContainText(String(s.anomalies_detected))
    await expect(dashboard.kpi('Alta prioridad')).toContainText(String(s.requiring_attention))
    await expect(dashboard.confidenceMeter()).toHaveAttribute('aria-valuenow', String(s.ai_confidence))
    await expectQuantity(dashboard.kpi('Consumo del periodo'), s.consumption.period_kwh / 1000, 'MWh')
  })

  test('CP-18 · las órdenes del Despacho siguen la prioridad de la API', async ({ dashboard, api }) => {
    const anomalies = (await (await api.anomalies()).json()) as Anomaly[]
    await dashboard.goto()
    await expect(dashboard.leadOrder(anomalies[0].meter_id)).toContainText(`Orden 1 de ${anomalies.length}`)
    for (const a of anomalies.slice(1)) {
      await expect(dashboard.orders.getByRole('link', { name: a.meter_id, exact: true })).toBeVisible()
      await expect(dashboard.orders.getByRole('article').filter({ hasText: a.meter_id })).toContainText(`orden ${a.priority}`)
    }
  })

  for (const e of EXPECTED_ANOMALIES.filter((x) => x.meterId !== 'M-106')) {
    test(`CP-22 · detalle de ${e.meterId}: cifras y estado = API, estado = tabla de decisión`, async ({ meterDetail, api }) => {
      const m = (await (await api.meter(e.meterId)).json()) as MeterDetail
      expect(m.status).toBe(e.status)

      await meterDetail.goto(e.meterId)
      await meterDetail.waitFor(e.meterId)
      await expect(meterDetail.status(e.meterId)).toHaveText(e.status === 'CRITICAL' ? 'Crítica' : 'Alerta')
      await expectQuantity(meterDetail.field(e.meterId, 'Consumo actual · 24 h'), m.consumption_kwh, 'kWh')
      await expectQuantity(meterDetail.field(e.meterId, 'Baseline diario'), m.baseline_kwh, 'kWh')
      await expectQuantity(meterDetail.field(e.meterId, 'Variación'), m.variation_pct, '%')
      await expect(meterDetail.field(e.meterId, 'Severidad')).toContainText(e.severityLabel)
      await expect(meterDetail.orderHeading()).toHaveText(`Orden ${e.priority} · ${e.typeLabel} · ${e.shortAction}`)
    })
  }

  test('CP-22 · un medidor sano (M-101) se muestra Normal y sin orden', async ({ meterDetail, api }) => {
    const m = (await (await api.meter('M-101')).json()) as MeterDetail
    expect(m.anomaly).toBeNull()
    await meterDetail.goto('M-101')
    await meterDetail.waitFor('M-101')
    await expect(meterDetail.status('M-101')).toHaveText('Normal')
    await expect(meterDetail.noOrderMessage()).toBeVisible()
    await expect(meterDetail.openInvestigation).toBeHidden()
  })
})
