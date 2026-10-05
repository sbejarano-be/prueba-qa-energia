import type { AnomalyType, MeterStatus, Severity } from '../api/types'

/**
 * Oráculo de las pruebas: lo que el sistema DEBE hacer según la documentación.
 * Cada valor cita su fuente. No se toma nada del código de la aplicación.
 */

/** README.md / frontend/PRODUCT.md · "Operating Context". */
export const DATASET = {
  meters: 12,
  meterIds: Array.from({ length: 12 }, (_, i) => `M-${101 + i}`),
  readings: 4032,
  days: 14,
  from: '2026-09-01T00:00:00Z',
  to: '2026-09-14T23:00:00Z',
} as const

export interface ExpectedAnomaly {
  priority: number
  meterId: string
  type: AnomalyType
  severity: Severity
  confidence: number
  /** Etiquetas de la UI (frontend/README.md · "Anomalías IA"). */
  typeLabel: string
  severityLabel: string
  shortAction: string
  /** Inicio de la acción recomendada del README (texto del motor). */
  actionStartsWith?: string
  /** ¿Es una anomalía que se escala? (FALSE_POSITIVE → "No escalar"). */
  escalate: boolean
  /** Estado de alerta esperado según backend/README · "Estado de alerta de un medidor". */
  status: MeterStatus
}

/** backend/README.md · "Resultado sobre el dataset" (4 anomalías · 2 prioritarias). */
export const EXPECTED_ANOMALIES: readonly ExpectedAnomaly[] = [
  {
    priority: 1,
    meterId: 'M-109',
    type: 'REAL_ANOMALY',
    severity: 'HIGH',
    confidence: 0.95,
    typeLabel: 'Anomalía real',
    severityLabel: 'Alta',
    shortAction: 'Investigar',
    actionStartsWith: 'Investigar en sitio',
    escalate: true,
    status: 'CRITICAL',
  },
  {
    priority: 2,
    meterId: 'M-112',
    type: 'DATA_QUALITY',
    severity: 'HIGH',
    confidence: 0.95,
    typeLabel: 'Calidad de datos',
    severityLabel: 'Alta',
    shortAction: 'Validar medidor',
    escalate: true,
    status: 'CRITICAL',
  },
  {
    priority: 3,
    meterId: 'M-104',
    type: 'EXPLAINABLE_ANOMALY',
    severity: 'MEDIUM',
    confidence: 0.86,
    typeLabel: 'Anomalía explicable',
    severityLabel: 'Media',
    shortAction: 'Validar operación',
    escalate: true,
    status: 'ALERT',
  },
  {
    priority: 4,
    meterId: 'M-106',
    type: 'FALSE_POSITIVE',
    severity: 'LOW',
    confidence: 0.86,
    typeLabel: 'Falso positivo',
    severityLabel: 'Baja',
    shortAction: 'No escalar',
    escalate: false,
    // Tabla de decisión: "Sin anomalía, o FALSE_POSITIVE → NORMAL".
    status: 'NORMAL',
  },
]

export const REQUIRING_ATTENTION = EXPECTED_ANOMALIES.filter((a) => a.severity === 'HIGH').length // 2

/**
 * Tabla de decisión "Estado de alerta de un medidor" (backend/README.md):
 *   Sin anomalía, o FALSE_POSITIVE → NORMAL · Severidad HIGH → CRITICAL · Cualquier otra → ALERT
 */
export function expectedStatus(anomaly: { type: AnomalyType; severity: Severity } | null): MeterStatus {
  if (!anomaly || anomaly.type === 'FALSE_POSITIVE') return 'NORMAL'
  if (anomaly.severity === 'HIGH') return 'CRITICAL'
  return 'ALERT'
}

/** Estado esperado de los 12 medidores aplicando la tabla anterior. */
export const EXPECTED_STATUS_BY_METER: Record<string, MeterStatus> = Object.fromEntries(
  DATASET.meterIds.map((id) => {
    const anomaly = EXPECTED_ANOMALIES.find((a) => a.meterId === id) ?? null
    return [id, expectedStatus(anomaly)]
  }),
)

/** Conteo esperado por estado: 9 normales · 1 alerta · 2 críticas. */
export const EXPECTED_STATUS_COUNTS = {
  normal: Object.values(EXPECTED_STATUS_BY_METER).filter((s) => s === 'NORMAL').length,
  alert: Object.values(EXPECTED_STATUS_BY_METER).filter((s) => s === 'ALERT').length,
  critical: Object.values(EXPECTED_STATUS_BY_METER).filter((s) => s === 'CRITICAL').length,
} as const

/** backend/README.md · "En la lista y el detalle..." (M-109: 2.207,6 kWh contra 1.052,15 kWh, +109,8 %). */
export const M109 = {
  id: 'M-109',
  consumptionKwh: 2207.6,
  baselineKwh: 1052.15,
  variationPct: 109.8,
  /** "desde 12/09 14:00" (backend/README · ejemplo de salida). Hora de planta. */
  changeStartPlant: '12/09 14:00',
  changeStartIso: '2026-09-12T14:00:00Z',
  changeHours: 58,
  changePct: 110.5,
  /** "Por eso M-109 (2.825 kWh de más) va antes que M-112 (0 kWh)". */
  impactKwh: 2825,
} as const

/** Los 7 pasos del pipeline (backend/README · "Run AI Analysis y OpenAI"). */
export const PIPELINE_STEPS = ['Lecturas', 'Baseline', 'Detección', 'Correlación', 'Eventos', 'Explicación', 'Recomendación'] as const

/** Límites documentados (backend/README y Swagger). */
export const LIMITS = {
  pageSizeDefault: 10,
  pageSizeMax: 100,
  meterIdMaxChars: 50,
  confidenceMin: 0.5,
  confidenceMax: 0.95,
  eventTrust: 0.9,
} as const

/** Mensajes de la UI (frontend/README.md, textos visibles del producto). */
export const UI_TEXT = {
  loginRequired: 'Escribe tu email y tu contraseña.',
  loginInvalid: 'Email o contraseña incorrectos. Revisa los datos e inténtalo de nuevo.',
  emptyLedger: 'Ningún medidor coincide con los filtros',
} as const
