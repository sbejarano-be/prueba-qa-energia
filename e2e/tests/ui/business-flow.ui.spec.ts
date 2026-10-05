import type { Anomaly, MeterDetail } from '../../api/types'
import { env } from '../../config/env'
import { EXPECTED_ANOMALIES, M109 } from '../../data/oracle'
import { expect, test } from '../../fixtures/test'
import { expectQuantity } from '../../utils/assertions'
import { confidence } from '../../utils/format'

/**
 * Flujo E2E de negocio (PRUEBA_QA.md · Parte F, mínimo obligatorio), el mismo recorrido
 * del evaluador en frontend/PRODUCT.md:
 *   Login → Despacho → Libro de medidores → filtrar y buscar → detalle de M-109 →
 *   investigación → acción recomendada.
 * Cada cifra de la UI se valida contra la API y contra la documentación (README).
 */
test.use({ storageState: { cookies: [], origins: [] } })

test('E2E-01 · el operador encuentra el medidor prioritario y sabe qué hacer', { tag: ['@e2e', '@regression'] }, async ({
  page,
  api,
  loginPage,
  dashboard,
  shell,
  metersPage,
  meterDetail,
  investigation,
}) => {
  const expected = EXPECTED_ANOMALIES[0] // M-109 · REAL_ANOMALY · HIGH · 0,95
  const detail = (await (await api.meter(M109.id)).json()) as MeterDetail
  const anomaly = ((await (await api.anomalies()).json()) as Anomaly[]).find((a) => a.meter_id === M109.id)!

  await test.step('1 · login con las credenciales del operador', async () => {
    await loginPage.goto()
    await loginPage.login(env.credentials.email, env.credentials.password)
    await expect(dashboard.heading).toBeVisible()
  })

  await test.step('2 · el Despacho pone a M-109 como orden de prioridad máxima', async () => {
    const lead = dashboard.leadOrder(M109.id)
    await expect(lead).toContainText('Prioridad máxima')
    await expect(lead).toContainText(expected.typeLabel)
    await expect(lead).toContainText('Crítica')
  })

  await test.step('3 · Libro de medidores: filtro "Críticas" → solo M-109 y M-112', async () => {
    await shell.goTo('Medidores')
    await metersPage.waitForRows()
    await metersPage.filterByStatus('Críticas')
    await expect(page).toHaveURL(/estado=CRITICAL/)
    await expect(metersPage.table.getByRole('rowheader')).toHaveText(['M-109', 'M-112'])
  })

  await test.step('4 · búsqueda parcial "109" → solo M-109 con sus cifras', async () => {
    await metersPage.searchMeter('109')
    await expect(page).toHaveURL(/medidor=109/)
    await expect(metersPage.table.getByRole('rowheader')).toHaveText([M109.id])
    const row = metersPage.row(M109.id)
    await expect(row).toContainText('kWh')
    await expectQuantity(row, detail.consumption_kwh, 'kWh')
    await expect(row).toContainText('Crítica')
  })

  await test.step('5 · detalle de M-109: consumo, baseline, variación y estado = API = README', async () => {
    await metersPage.openMeter(M109.id)
    await meterDetail.waitFor(M109.id)
    await expect(page).toHaveURL(/\/medidores\/M-109$/)

    // API = README (oráculo documental)
    expect(detail.consumption_kwh).toBeCloseTo(M109.consumptionKwh, 1)
    expect(detail.baseline_kwh).toBeCloseTo(M109.baselineKwh, 2)
    expect(detail.variation_pct).toBeCloseTo(M109.variationPct, 1)

    // UI = API (formato es-CO)
    await expectQuantity(meterDetail.field(M109.id, 'Consumo actual · 24 h'), detail.consumption_kwh, 'kWh') // 2.207,6 kWh
    await expectQuantity(meterDetail.field(M109.id, 'Baseline diario'), detail.baseline_kwh, 'kWh')
    await expectQuantity(meterDetail.field(M109.id, 'Variación'), detail.variation_pct, '%') // +109,8 %
    await expect(meterDetail.status(M109.id)).toHaveText('Crítica')
    await expect(meterDetail.field(M109.id, 'Severidad')).toContainText(expected.severityLabel)
    await expect(meterDetail.orderHeading()).toHaveText(`Orden 1 · ${expected.typeLabel} · ${expected.shortAction}`)
  })

  await test.step('6 · investigación: acción recomendada concreta y confianza 0,95', async () => {
    await meterDetail.openInvestigation.click()
    await investigation.waitFor(M109.id)
    await expect(investigation.priorityText(M109.id)).toHaveText(`Orden de trabajo · Prioridad 1 de ${EXPECTED_ANOMALIES.length}`)
    await expect(investigation.action).toContainText(anomaly.recommended_action)
    await expect(investigation.action).toContainText(/Investigar en sitio/)
    await expect(investigation.confidence(M109.id)).toHaveAttribute('aria-valuetext', `${confidence(expected.confidence)} (Alta)`)
    await expect(investigation.reason()).toHaveText(anomaly.reason)
  })
})
