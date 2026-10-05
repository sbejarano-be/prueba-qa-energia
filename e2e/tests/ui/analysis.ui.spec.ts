import { EXPECTED_ANOMALIES, PIPELINE_STEPS, REQUIRING_ATTENTION } from '../../data/oracle'
import { expect, test } from '../../fixtures/test'

/**
 * Run AI Analysis por la UI · transición de estados de los 7 pasos
 * (Pendiente → En curso → Hecho) mientras el front hace polling.
 */
test.describe('Run AI Analysis · UI', { tag: '@regression' }, () => {
  test('CP-25 · el análisis recorre los 7 pasos y termina con el resumen 4 · 2', async ({ page, dashboard, shell, analysisSheet, anomaliesPage }) => {
    await dashboard.goto()
    await shell.runAnalysis.click()

    await expect(analysisSheet.root).toBeVisible()
    await expect(analysisSheet.steps).toHaveCount(PIPELINE_STEPS.length)
    for (const [i, label] of PIPELINE_STEPS.entries()) {
      await expect(analysisSheet.steps.nth(i)).toContainText(`${i + 1} · ${label}`)
    }

    // Estado final: los 7 pasos en "Hecho" (texto sr-only) y el resumen sellado.
    await expect(analysisSheet.steps.filter({ hasText: 'Hecho' })).toHaveCount(PIPELINE_STEPS.length, { timeout: 30_000 })
    await expect(analysisSheet.summary).toContainText(`${EXPECTED_ANOMALIES.length} anomalías · ${REQUIRING_ATTENTION} prioritarias`)
    await expect(shell.runAnalysis).toBeEnabled()
    await expect(shell.runAnalysis).toContainText('Run AI Analysis')

    await analysisSheet.viewOrders.click()
    await expect(page).toHaveURL(/\/anomalias$/)
    await expect(anomaliesPage.heading).toBeVisible()
    await expect(analysisSheet.root).toBeHidden()
  })

  test('CP-25 · la hoja se puede cerrar sin perder la pantalla actual', async ({ page, metersPage, shell, analysisSheet }) => {
    await metersPage.goto()
    await shell.runAnalysis.click()
    await expect(analysisSheet.root).toBeVisible()
    await analysisSheet.close.click()
    await expect(analysisSheet.root).toBeHidden()
    await expect(page).toHaveURL(/\/medidores$/)
    await expect(metersPage.heading).toBeVisible()
  })
})
