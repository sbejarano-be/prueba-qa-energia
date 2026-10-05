import type { Anomaly, MeterSummary, Paged, Severity } from '../../api/types'
import { EXPECTED_ANOMALIES, EXPECTED_STATUS_BY_METER, LIMITS, M109 } from '../../data/oracle'
import { expect, test } from '../../fixtures/test'

const rank: Record<Severity, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 }
const dependsOnEvent = (a: Anomaly) => a.type === 'EXPLAINABLE_ANOMALY' || a.type === 'FALSE_POSITIVE'

test.describe('Anomalías · tabla de decisión del motor', { tag: '@regression' }, () => {
  let anomalies: Anomaly[]

  test.beforeEach(async ({ api }) => {
    const res = await api.anomalies()
    expect(res.status()).toBe(200)
    anomalies = (await res.json()) as Anomaly[]
  })

  test('CP-15 · las 4 anomalías del README con tipo, severidad, confianza y prioridad', async () => {
    expect(anomalies.map((a) => a.meter_id)).toEqual(EXPECTED_ANOMALIES.map((e) => e.meterId))
    for (const e of EXPECTED_ANOMALIES) {
      const a = anomalies.find((x) => x.meter_id === e.meterId)!
      expect(a, e.meterId).toMatchObject({ type: e.type, severity: e.severity, priority: e.priority, anomaly: e.escalate })
      expect(a.confidence, e.meterId).toBeCloseTo(e.confidence, 2)
    }
  })

  test('CP-15 · cada anomalía tiene explicación y una acción concreta (M-109: investigar en sitio)', async () => {
    for (const a of anomalies) {
      expect(a.reason.length, a.meter_id).toBeGreaterThan(20)
      expect(a.recommended_action.length, a.meter_id).toBeGreaterThan(20)
      expect(a.narrated_by, a.meter_id).toMatch(/^(engine|openai:.+)$/)
    }
    const m109 = anomalies.find((a) => a.meter_id === M109.id)!
    expect(m109.recommended_action).toMatch(/^Investigar en sitio/)
    expect(m109.reason).toContain(`desde ${M109.changeStartPlant}`)
  })

  test('CP-15 · priorización: severidad ↓, luego energía en juego |kWh| ↓, luego confianza ↓', async () => {
    for (let i = 1; i < anomalies.length; i++) {
      const [prev, cur] = [anomalies[i - 1], anomalies[i]]
      const key = (a: Anomaly) => [rank[a.severity], Math.abs(a.evidence.impact_kwh), a.confidence]
      const [p, c] = [key(prev), key(cur)]
      const firstDiff = p.findIndex((v, k) => v !== c[k])
      if (firstDiff >= 0) expect(p[firstDiff], `${prev.meter_id} antes que ${cur.meter_id}`).toBeGreaterThan(c[firstDiff])
      expect(cur.priority).toBe(prev.priority + 1)
    }
  })

  test('CP-15 · ejemplo completo M-109 (README): 58 h, +110,5 %, ~2.825 kWh de más, sigue activo', async () => {
    const a = anomalies.find((x) => x.meter_id === M109.id)!
    expect(a.evidence.change).toMatchObject({ start: M109.changeStartIso, hours: M109.changeHours, direction: 'UP', ongoing: true })
    expect(a.evidence.change!.change_pct).toBeCloseTo(M109.changePct, 1)
    expect(a.evidence.impact_kwh).toBeCloseTo(M109.impactKwh, -1)
    expect(a.evidence.related_events.map((e) => e.type)).toEqual(['UNKNOWN'])
  })

  test('CP-15 · eventos: el tipo de evento explica la dirección del cambio (tabla de eventos)', async () => {
    const byId = Object.fromEntries(anomalies.map((a) => [a.meter_id, a]))
    // OPERATIONAL_CHANGE explica un aumento → EXPLAINABLE_ANOMALY
    expect(byId['M-104'].evidence.change?.direction).toBe('UP')
    expect(byId['M-104'].evidence.related_events.map((e) => e.type)).toContain('OPERATIONAL_CHANGE')
    // SCHEDULED_OUTAGE explica una caída que ya terminó → FALSE_POSITIVE
    expect(byId['M-106'].evidence.change).toMatchObject({ direction: 'DOWN', ongoing: false })
    expect(byId['M-106'].evidence.related_events.map((e) => e.type)).toContain('SCHEDULED_OUTAGE')
    // DATA_QUALITY: M-112 no mueve energía (0 kWh) y su severidad HIGH exige ≥ 12 horas sospechosas
    expect(byId['M-112'].evidence.impact_kwh).toBe(0)
    expect(byId['M-112'].evidence.quality!.flagged_hours).toBeGreaterThanOrEqual(12)
  })

  test('CP-17 · confianza: rango [0,5; 0,95], pesos que suman 1 y fórmula documentada (×0,9 si depende de un evento)', async () => {
    for (const a of anomalies) {
      const checks = a.evidence.checks
      expect(checks, a.meter_id).toHaveLength(4)
      expect(checks.reduce((s, c) => s + c.weight, 0), a.meter_id).toBeCloseTo(1, 6)
      for (const c of checks) {
        expect(c.strength).toBeGreaterThanOrEqual(0)
        expect(c.strength).toBeLessThanOrEqual(1)
      }

      const score = checks.reduce((s, c) => s + c.weight * c.strength, 0)
      const trust = dependsOnEvent(a) ? LIMITS.eventTrust : 1
      const expected = Math.round((0.5 + 0.45 * score) * trust * 100) / 100
      expect(a.confidence, a.meter_id).toBeCloseTo(expected, 2)
      expect(a.confidence, a.meter_id).toBeLessThanOrEqual(LIMITS.confidenceMax)
      expect(a.confidence, a.meter_id).toBeGreaterThanOrEqual(LIMITS.confidenceMin)
    }
  })
})

test.describe('Estado de alerta · tabla de decisión (backend/README)', { tag: '@regression' }, () => {
  let rows: MeterSummary[]

  test.beforeEach(async ({ api }) => {
    rows = ((await (await api.meters({ pagination: { size: 100 } })).json()) as Paged<MeterSummary>).rows
  })

  test('CP-16 · R1: sin anomalía → NORMAL (los 8 medidores sanos)', async () => {
    const healthy = rows.filter((r) => r.anomaly_type === null)
    expect(healthy).toHaveLength(8)
    for (const r of healthy) expect(r.status, r.meter_id).toBe('NORMAL')
  })

  test('CP-16 · R3: severidad HIGH → CRITICAL (M-109, M-112)', async () => {
    const high = rows.filter((r) => r.severity === 'HIGH')
    expect(high.map((r) => r.meter_id)).toEqual(['M-109', 'M-112'])
    for (const r of high) expect(r.status, r.meter_id).toBe('CRITICAL')
  })

  test('CP-16 · R4: cualquier otra anomalía (M-104 EXPLAINABLE/MEDIUM) → ALERT', async () => {
    const m104 = rows.find((r) => r.meter_id === 'M-104')!
    expect(m104).toMatchObject({ anomaly_type: 'EXPLAINABLE_ANOMALY', severity: 'MEDIUM', status: EXPECTED_STATUS_BY_METER['M-104'] })
  })

  // R2 (FALSE_POSITIVE → NORMAL) falla hoy: ver tests/defects/defects.api.spec.ts · DEF-01.
})
