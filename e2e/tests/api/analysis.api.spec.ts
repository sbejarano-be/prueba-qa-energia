import type { AnalysisRun } from '../../api/types'
import { EXPECTED_ANOMALIES, PIPELINE_STEPS, REQUIRING_ATTENTION } from '../../data/oracle'
import { expect, test } from '../../fixtures/test'

/**
 * Run AI Analysis por API · transición de estados.
 * Corrida:  RUNNING → COMPLETED.   Paso: PENDING → RUNNING → DONE.
 * Comparte estado del servidor (historial de corridas): se ejecuta en serie.
 */
test.describe('Run AI Analysis · API', { tag: '@regression' }, () => {
  test.describe.configure({ mode: 'serial' })

  test('CP-25 · POST /ai/analyze inicia una corrida que termina COMPLETED con los 7 pasos en DONE', async ({ api }) => {
    const start = await api.analyze()
    // 202 = corrida nueva; 200 = ya había una en curso (otro worker) y se devuelve esa.
    expect([200, 202]).toContain(start.status())
    const run = (await start.json()) as AnalysisRun
    expect(run.id).toMatch(/^AN-\d{4}$/)
    expect(run.steps.map((s) => s.label)).toEqual([...PIPELINE_STEPS])

    await expect
      .poll(async () => ((await (await api.analysis(run.id)).json()) as AnalysisRun).status, { timeout: 30_000 })
      .toBe('COMPLETED')

    const done = (await (await api.analysis(run.id)).json()) as AnalysisRun
    expect(done.steps.every((s) => s.status === 'DONE')).toBe(true)
    expect(done.finished_at).not.toBeNull()
    expect(done.summary).toMatchObject({ anomalies_detected: EXPECTED_ANOMALIES.length, requiring_attention: REQUIRING_ATTENTION })
  })

  test('CP-25 · /ai/analysis/latest devuelve una corrida terminada o en curso', async ({ api }) => {
    const res = await api.latestAnalysis()
    expect(res.status()).toBe(200)
    const run = (await res.json()) as AnalysisRun
    expect(['RUNNING', 'COMPLETED']).toContain(run.status)
    expect(['STARTUP', 'MANUAL']).toContain(run.trigger)
  })

  test('CP-25 · consultar un análisis inexistente → 404 con el formato de error', async ({ api }) => {
    const res = await api.analysis('AN-9999')
    expect(res.status()).toBe(404)
    expect(await res.json()).toMatchObject({ status_code: 404, path: '/api/v1/ai/analysis/AN-9999' })
  })

  test('CP-25 · el análisis no altera el resultado del motor (determinístico)', async ({ api }) => {
    const before = await (await api.anomalies()).json()
    const run = (await (await api.analyze()).json()) as AnalysisRun
    await expect
      .poll(async () => ((await (await api.analysis(run.id)).json()) as AnalysisRun).status, { timeout: 30_000 })
      .toBe('COMPLETED')
    const after = await (await api.anomalies()).json()
    // narrated_by puede variar si hay OpenAI; tipo, severidad, confianza y prioridad no.
    const pick = (list: { meter_id: string; type: string; severity: string; confidence: number; priority: number }[]) =>
      list.map(({ meter_id, type, severity, confidence, priority }) => ({ meter_id, type, severity, confidence, priority }))
    expect(pick(after)).toEqual(pick(before))
  })
})
