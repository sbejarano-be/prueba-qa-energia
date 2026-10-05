import type { Anomaly } from '../../api/types'
import { EXPECTED_ANOMALIES, REQUIRING_ATTENTION } from '../../data/oracle'
import { expect, test } from '../../fixtures/test'
import { confidence } from '../../utils/format'

test.describe('Anomalías IA · UI', { tag: '@regression' }, () => {
  test('CP-24 · la tabla muestra las 4 anomalías en el orden y con los valores de la tabla de decisión', async ({ page, anomaliesPage, api }) => {
    await anomaliesPage.goto()
    await expect(page.getByText(`${EXPECTED_ANOMALIES.length} anomalías detectadas · ${REQUIRING_ATTENTION} requieren atención prioritaria`)).toBeVisible()

    const apiRows = (await (await api.anomalies()).json()) as Anomaly[]
    const rows = await anomaliesPage.rows()
    expect(rows).toHaveLength(EXPECTED_ANOMALIES.length)

    for (const [i, e] of EXPECTED_ANOMALIES.entries()) {
      const r = rows[i]
      expect(r['Prior.'], e.meterId).toBe(String(e.priority))
      expect(r['Medidor'], e.meterId).toBe(e.meterId)
      expect(r['Tipo'], e.meterId).toBe(e.typeLabel)
      expect(r['Severidad'], e.meterId).toBe(e.severityLabel)
      expect(r['Confianza'], e.meterId).toContain(confidence(e.confidence))
      expect(r['Acción'], e.meterId).toBe(e.shortAction)
      // UI = API
      expect(r['Medidor']).toBe(apiRows[i].meter_id)
      expect(r['Confianza']).toContain(confidence(apiRows[i].confidence))
    }
  })

  test('CP-24 · el falso positivo M-106 no se escala: "No escalar" en la tabla y en su orden', async ({ anomaliesPage, investigation }) => {
    await anomaliesPage.goto()
    await anomaliesPage.open('M-106')
    await investigation.waitFor('M-106')
    await expect(investigation.order('M-106')).toContainText('Falso positivo')
    await expect(investigation.order('M-106')).toContainText('No escalar')
    await expect(investigation.action).toContainText('No escalar')
  })

  test('CP-24 · investigación de M-112: calidad de datos, sin energía en juego, acción "Validar medidor"', async ({ investigation, api }) => {
    const a = ((await (await api.anomalies()).json()) as Anomaly[]).find((x) => x.meter_id === 'M-112')!
    await investigation.goto('M-112')
    await investigation.waitFor('M-112')
    await expect(investigation.order('M-112')).toContainText('Calidad de datos')
    await expect(investigation.action).toContainText('Validar medidor')
    await expect(investigation.action).toContainText(a.recommended_action)
    await expect(investigation.windowFact('Horas sospechosas')).toContainText(`${a.evidence.quality!.flagged_hours} h`)
  })

  test('CP-24 · un medidor sin anomalía no tiene orden de investigación', async ({ page, investigation }) => {
    await investigation.goto('M-101')
    await expect(page.getByRole('heading', { level: 1, name: 'No hay orden para M-101' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ver el medidor' })).toHaveAttribute('href', '/medidores/M-101')
  })

  test('CP-24 · ruta inexistente → página 404 de la app con salida al Despacho', async ({ page }) => {
    await page.goto('/ruta-que-no-existe')
    await expect(page.getByRole('heading', { level: 1, name: 'Esta página no existe' })).toBeVisible()
    await page.getByRole('link', { name: 'Ir al despacho' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Despacho' })).toBeVisible()
  })
})
