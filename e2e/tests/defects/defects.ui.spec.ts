import type { Anomaly, MeterSummary, Paged } from '../../api/types'
import { DATASET, EXPECTED_STATUS_COUNTS, M109 } from '../../data/oracle'
import { defect, expect, test } from '../../fixtures/test'
import { screenshotEvidence } from '../../utils/evidence'
import { parseEsNumber, plantTime } from '../../utils/format'

/**
 * Defectos visibles en la UI. Cada test asevera lo que dice la documentación: hoy falla
 * (test.fail) y pasará cuando se corrija. Los navegadores corren en America/Bogota
 * (playwright.config.ts · timezoneId), la zona de los operadores. Detalle en qa/05-defectos.md.
 */
test.describe('Defectos · UI', () => {
  test.fail(
    'DEF-02 · CP-23 · la hora de planta se muestra tal como viene (M-109 detectada 12/09 14:00), no en la zona del navegador',
    defect('DEF-02', 'Hora de planta convertida a la zona del navegador'),
    async ({ page, investigation, api }, testInfo) => {
      const a = ((await (await api.anomalies()).json()) as Anomaly[]).find((x) => x.meter_id === M109.id)!
      expect(plantTime(a.detected_at)).toBe(M109.changeStartPlant) // oráculo: "12/09 14:00"
      expect(a.reason).toContain(`desde ${M109.changeStartPlant}`) // el propio texto del motor lo dice

      await investigation.goto(M109.id)
      await investigation.waitFor(M109.id)
      await expect(investigation.reason()).toContainText(`desde ${M109.changeStartPlant}`)
      await screenshotEvidence(page, testInfo, 'DEF-02-hora-de-planta-M-109')

      // La misma pantalla debe ser coherente consigo misma y con la API.
      await expect.soft(investigation.windowFact('Duración')).toContainText(`Desde ${M109.changeStartPlant}`, { timeout: 3_000 })
      await expect(investigation.detectedAt(M109.id)).toHaveText(`Detectada ${M109.changeStartPlant} · hora de planta`, { timeout: 3_000 })
    },
  )

  test.fail(
    'DEF-02 · CP-23 · la columna "Última lectura" muestra la última hora del dataset (14/09 23:00)',
    defect('DEF-02', 'Hora de planta convertida a la zona del navegador'),
    async ({ page, metersPage }, testInfo) => {
      await metersPage.goto()
      await metersPage.waitForRows()
      await screenshotEvidence(page, testInfo, 'DEF-02-ultima-lectura-libro')
      await expect(metersPage.row('M-101')).toContainText(plantTime(DATASET.to), { timeout: 3_000 }) // "14/09 23:00"
    },
  )

  test.fail(
    'DEF-03 · CP-20 · con 12 medidores y 10 por página, "Siguiente" lleva a 11–12',
    defect('DEF-03', 'Paginación: Siguiente deshabilitado, M-111 y M-112 inalcanzables'),
    async ({ page, metersPage }, testInfo) => {
      await metersPage.goto()
      await metersPage.waitForRows()
      await expect(metersPage.rangeText()).toHaveText(`1–10 de ${DATASET.meters} medidores`)
      await screenshotEvidence(page, testInfo, 'DEF-03-paginacion-siguiente-deshabilitado')

      await expect(metersPage.next).toBeEnabled({ timeout: 3_000 })
      await metersPage.next.click()
      await expect(metersPage.table.getByRole('rowheader')).toHaveText(['M-111', 'M-112'])
    },
  )

  test.fail(
    'DEF-01 · CP-22 · M-106 (falso positivo) se muestra Normal en su detalle',
    defect('DEF-01', 'FALSE_POSITIVE se muestra como ALERT'),
    async ({ page, meterDetail }, testInfo) => {
      await meterDetail.goto('M-106')
      await meterDetail.waitFor('M-106')
      await screenshotEvidence(page, testInfo, 'DEF-01-detalle-M-106-alerta')
      await expect(meterDetail.status('M-106')).toHaveText('Normal', { timeout: 3_000 })
    },
  )

  test.fail(
    'DEF-01 · CP-18 · el KPI "Medidores" dice 9 normales · 1 alerta · 2 críticas',
    defect('DEF-01', 'FALSE_POSITIVE se muestra como ALERT'),
    async ({ page, dashboard }, testInfo) => {
      await dashboard.goto()
      await expect(dashboard.kpi('Medidores')).toContainText(/normales/)
      await screenshotEvidence(page, testInfo, 'DEF-01-kpi-medidores')
      const { normal, alert, critical } = EXPECTED_STATUS_COUNTS
      await expect(dashboard.kpi('Medidores')).toContainText(`${normal} normales · ${alert} alerta · ${critical} críticas`, { timeout: 3_000 })
    },
  )

  test.fail(
    'DEF-04 · CP-19 · buscar "m-109" en minúsculas encuentra M-109',
    defect('DEF-04', 'Búsqueda meter_id sensible a mayúsculas'),
    async ({ page, metersPage }, testInfo) => {
      await metersPage.goto()
      await metersPage.waitForRows()
      await metersPage.searchMeter('m-109')
      await expect(page).toHaveURL(/medidor=m-109/)
      await expect(metersPage.emptyState.or(metersPage.table.getByRole('rowheader').first())).toBeVisible()
      await screenshotEvidence(page, testInfo, 'DEF-04-busqueda-minusculas')
      await expect(metersPage.table.getByRole('rowheader')).toHaveText(['M-109'], { timeout: 3_000 })
    },
  )

  test.fail(
    'DEF-06 · CP-21 · una página fuera de rango (?pagina=5) no muestra un rango imposible ("41–12 de 12")',
    defect('DEF-06', 'Página fuera de rango sin control'),
    async ({ page, metersPage, api }, testInfo) => {
      const body = (await (await api.meters({ pagination: { page: 5, size: 10 } })).json()) as Paged<MeterSummary>
      expect(body).toMatchObject({ count: DATASET.meters, rows: [] }) // la API responde bien: lista vacía

      await metersPage.goto('?pagina=5')
      await expect(metersPage.rangeText().or(metersPage.emptyState)).toBeVisible()
      await screenshotEvidence(page, testInfo, 'DEF-06-pagina-fuera-de-rango')
      // Esperado: estado vacío o ajuste a la última página; nunca "desde" > "hasta".
      const range = (await metersPage.rangeText().textContent()) ?? ''
      const [from, to] = range.split(' de ')[0].split('–').map(Number)
      expect(from, `rango mostrado: "${range}"`).toBeLessThanOrEqual(to)
    },
  )

  test.fail(
    'DEF-10 · la cuenta de la confianza de M-104 cuadra aritméticamente con el valor mostrado',
    defect('DEF-10', 'Fórmula de confianza sin paréntesis'),
    async ({ page, investigation }, testInfo) => {
      await investigation.goto('M-104')
      await investigation.waitFor('M-104')
      const formula = investigation.confidenceFormula()
      await expect(formula).toBeVisible()
      await screenshotEvidence(page, testInfo, 'DEF-10-formula-confianza-M-104')

      // "0,5 + 0,45 × 1,000 × 0,9 = 0,86" se lee (precedencia normal) como 0,5 + 0,405 = 0,905 ≠ 0,86.
      const text = (await formula.textContent()) ?? ''
      const [left, right] = text.split('=')
      const factors = left.split('+')[1].split('×').map(parseEsNumber)
      const evaluated = parseEsNumber(left.split('+')[0]) + factors.reduce((p, f) => p * f, 1)
      expect(evaluated, `"${text}" evaluada = ${evaluated.toFixed(3)}`).toBeCloseTo(parseEsNumber(right), 2)
    },
  )
})
