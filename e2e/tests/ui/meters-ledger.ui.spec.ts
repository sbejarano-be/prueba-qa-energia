import type { MeterSummary, Paged } from '../../api/types'
import { DATASET } from '../../data/oracle'
import { expect, test } from '../../fixtures/test'
import { expectQuantity } from '../../utils/assertions'
import { readTable } from '../../utils/table'

const statusLabel = { NORMAL: 'Normal', ALERT: 'Alerta', CRITICAL: 'Crítica' } as const

test.describe('Libro de medidores · UI', { tag: '@regression' }, () => {
  test('CP-19 · página por defecto: 10 medidores por meter_id, cifras = API', async ({ metersPage, api }) => {
    await metersPage.goto()
    await metersPage.waitForRows()

    const apiRows = ((await (await api.meters()).json()) as Paged<MeterSummary>).rows
    const uiRows = await readTable(metersPage.table)

    expect(uiRows.map((r) => r['Medidor'])).toEqual(DATASET.meterIds.slice(0, 10))
    for (const [i, a] of apiRows.entries()) {
      const u = uiRows[i]
      expect(u['Estado'], a.meter_id).toBe(statusLabel[a.status])
      await expectQuantity(u['Consumo 24 h'], a.consumption_kwh, 'kWh')
      await expectQuantity(u['Baseline'], a.baseline_kwh, 'kWh')
      await expectQuantity(u['Variación'], a.variation_pct, '%')
    }
    await expect(metersPage.rangeText()).toHaveText(`1–10 de ${DATASET.meters} medidores`)
    await expect(metersPage.previous).toBeDisabled()
  })

  test('CP-19 · filtro "Críticas" + orden por consumo DESC: la URL guarda el estado y sobrevive a recargar', async ({ page, metersPage, api }) => {
    await metersPage.goto()
    await metersPage.waitForRows()

    await metersPage.filterByStatus('Críticas')
    await metersPage.sort('Consumo', 'DESC')
    await expect(page).toHaveURL(/estado=CRITICAL/)
    await expect(page).toHaveURL(/orden=consumption/)
    await expect(page).toHaveURL(/dir=DESC/)

    const apiOrder = ((await (await api.meters({ filter: { status: 'CRITICAL', sort_by: 'consumption', sort_order: 'DESC' } })).json()) as Paged<MeterSummary>).rows.map((r) => r.meter_id)
    await expect(metersPage.table.getByRole('rowheader')).toHaveText(apiOrder)

    await page.reload()
    await expect(metersPage.statusRadio('Críticas')).toBeChecked()
    await expect(metersPage.sortBy).toHaveValue('consumption')
    await expect(metersPage.table.getByRole('rowheader')).toHaveText(apiOrder)
  })

  test('CP-19 · búsqueda sin coincidencias → estado vacío y "Quitar filtros" restablece la lista', async ({ metersPage }) => {
    await metersPage.goto()
    await metersPage.waitForRows()

    await metersPage.searchMeter('ZZZ')
    await expect(metersPage.emptyState).toBeVisible()
    await expect(metersPage.table).toBeHidden()

    await metersPage.clearFilters.click()
    await metersPage.waitForRows()
    await expect(metersPage.rangeText()).toHaveText(`1–10 de ${DATASET.meters} medidores`)
    await expect(metersPage.search).toHaveValue('')
  })

  test('CP-19 · orden por severidad DESC: las anomalías primero, en orden HIGH → LOW', async ({ metersPage }) => {
    await metersPage.goto()
    await metersPage.waitForRows()
    await metersPage.sort('Severidad', 'DESC')
    // La tabla conserva las filas anteriores mientras llega la nueva página: se espera al resultado.
    await expect.poll(async () => (await metersPage.meterIds()).slice(0, 4)).toEqual(['M-109', 'M-112', 'M-104', 'M-106'])
  })

  test('CP-20 · la página 2 por URL muestra los medidores 11–12', async ({ metersPage }) => {
    await metersPage.goto('?pagina=2')
    await metersPage.waitForRows()
    await expect(metersPage.table.getByRole('rowheader')).toHaveText(['M-111', 'M-112'])
    await expect(metersPage.rangeText()).toHaveText(`11–12 de ${DATASET.meters} medidores`)
    await expect(metersPage.previous).toBeEnabled()
    await expect(metersPage.next).toBeDisabled()
  })

  test('CP-19 · clic en un medidor abre su detalle', async ({ page, metersPage, meterDetail }) => {
    await metersPage.goto()
    await metersPage.waitForRows()
    await metersPage.openMeter('M-104')
    await expect(page).toHaveURL(/\/medidores\/M-104$/)
    await meterDetail.waitFor('M-104')
    await expect(meterDetail.status('M-104')).toHaveText('Alerta')
  })
})
