import { expect, test } from '../../fixtures/test'

/** Suite de humo (UI). Justificación en qa/02-smoke.md. */
test.describe('Smoke · UI', { tag: '@smoke' }, () => {
  test('SMK-06 · con sesión, el Despacho muestra la orden de prioridad 1 (M-109)', async ({ dashboard }) => {
    await dashboard.goto()
    const lead = dashboard.leadOrder('M-109')
    await expect(lead).toBeVisible()
    await expect(lead).toContainText('Prioridad máxima')
    await expect(lead).toContainText('Anomalía real')
  })

  test('SMK-07 · la navegación principal lleva a Medidores y Anomalías IA', async ({ dashboard, shell, metersPage, anomaliesPage }) => {
    await dashboard.goto()

    await shell.goTo('Medidores')
    await expect(metersPage.heading).toBeVisible()
    await expect(shell.navLink('Medidores')).toHaveAttribute('aria-current', 'page')
    await metersPage.waitForRows()

    await shell.goTo('Anomalías IA')
    await expect(anomaliesPage.heading).toBeVisible()
    await expect(anomaliesPage.table.getByRole('rowheader')).toHaveCount(4)
  })

  test('SMK-08 · el detalle de M-109 carga con su orden', async ({ meterDetail }) => {
    await meterDetail.goto('M-109')
    await meterDetail.waitFor('M-109')
    await expect(meterDetail.orderHeading()).toBeVisible()
    await expect(meterDetail.openInvestigation).toBeVisible()
  })
})
