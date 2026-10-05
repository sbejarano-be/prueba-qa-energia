// Genera el dataset sintético de valores límite del motor (e2e/data/boundary).
// Uso: npm run generate:boundary-data   (determinístico: siempre produce los mismos CSV)
//
// Cada medidor aísla UN umbral documentado en backend/README.md · "Metodología".
// Base común: 14 días × 24 h desde 2026-09-01, consumo constante 10 kWh, 220 V, 50 A, FP 0,95.
// Con datos constantes la MAD es 0 y cualquier desviación supera |z| > 3,5: así el único
// factor que decide es el umbral bajo prueba.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HOURS = 14 * 24 // 336
const START = Date.UTC(2026, 8, 1, 0, 0, 0)
const BASE = { kwh: 10, volt: 220, amp: 50, pf: 0.95 }

/** Índice de hora absoluta del 2026-09-10 a las 05:00 (después de la semana de baseline). */
const DAY10_05 = 9 * 24 + 5

const lastHours = (n) => (i) => i >= HOURS - n

/** Medidores: id → descripción y modificador de cada lectura (o null para omitirla). */
const meters = [
  ['B-101', 'Control: todo constante', () => ({})],
  // §8 Severidad REAL_ANOMALY: "HIGH si la variación supera 50 % y sigue activa; MEDIUM si supera 20 %"
  ['B-102', 'Exactamente +50,0 % las últimas 6 h (activo)', (i) => (lastHours(6)(i) ? { kwh: 15, amp: 75 } : {})],
  ['B-103', '+50,1 % las últimas 6 h (activo)', (i) => (lastHours(6)(i) ? { kwh: 15.01, amp: 75.05 } : {})],
  ['B-104', 'Exactamente +20,0 % las últimas 6 h (activo)', (i) => (lastHours(6)(i) ? { kwh: 12, amp: 60 } : {})],
  // §3 Cambios sostenidos: "6 horas o más seguidas"
  ['B-105', '+100 % solo 5 h seguidas (no es cambio sostenido)', (i) => (lastHours(5)(i) ? { kwh: 20, amp: 100 } : {})],
  // §4 Calidad de datos: voltaje > ±5 % · "Con 3 horas sospechosas o más"
  ['B-106', 'Voltaje +10 % durante 2 h', (i) => (i >= DAY10_05 && i < DAY10_05 + 2 ? { volt: 242 } : {})],
  ['B-107', 'Voltaje +10 % durante 3 h', (i) => (i >= DAY10_05 && i < DAY10_05 + 3 ? { volt: 242 } : {})],
  // §4 "Faltan horas" cuenta como hora sospechosa → con 1 sola no llega a 3
  ['B-108', 'Una hora faltante (2026-09-10 05:00)', (i) => (i === DAY10_05 ? null : {})],
]

const pad = (n) => String(n).padStart(2, '0')
const stamp = (ms) => {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:00:00`
}

const lines = ['meter_id,timestamp,consumption_kwh,voltage_v,current_a,power_factor,status']
for (const [id, , modify] of meters) {
  for (let i = 0; i < HOURS; i++) {
    const patch = modify(i)
    if (patch === null) continue
    const r = { ...BASE, ...patch }
    lines.push([id, stamp(START + i * 3_600_000), r.kwh, r.volt, r.amp, r.pf, 'OK'].join(','))
  }
}

// Un evento UNKNOWN (no explica nada) para no depender de un events.csv vacío.
const events = [
  'meter_id,event_timestamp,event_type,description',
  'B-101,2026-09-12 00:00,UNKNOWN,Evento de control sin efecto',
]

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'boundary')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'readings.csv'), lines.join('\n') + '\n')
writeFileSync(join(outDir, 'events.csv'), events.join('\n') + '\n')
writeFileSync(
  join(outDir, 'README.md'),
  [
    '# Dataset sintético de valores límite',
    '',
    'Generado por `scripts/generate-boundary-data.mjs` (no editar a mano). Lo sirve una segunda',
    'instancia del backend (`DATA_DIR`, puerto 8081) para probar los umbrales documentados del motor.',
    '',
    '| Medidor | Caso |',
    '|---|---|',
    ...meters.map(([id, desc]) => `| ${id} | ${desc} |`),
    '',
  ].join('\n'),
)
console.log(`readings.csv: ${lines.length - 1} lecturas de ${meters.length} medidores → ${outDir}`)
